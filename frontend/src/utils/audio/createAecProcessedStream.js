'use client';

/**
 * createAecProcessedStream — wraps a mic stream with AEC (Acoustic Echo Cancellation).
 *
 * Uses the NLMS + Geigel AudioWorklet from aec-worklet.js to remove
 * acoustic echo (sound from speakers/other apps bleeding into mic).
 *
 * Usage:
 *   const aecStream = await createAecProcessedStream(micStream, audioContext);
 *   // Later, when playing remote audio:
 *   aecStream.pushFarEnd(playbackSamples);
 *   // Use aecStream.stream as the processed mic feed
 *
 * @param {MediaStream} micStream — raw microphone stream
 * @param {AudioContext} [existingContext] — optional existing AudioContext
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true]
 * @param {string} [options.mode='aec-only'] — 'aec-only' or 'aec+gate' (adds noise gate)
 * @returns {Promise<Object>} { stream, context, pushFarEnd, cleanup, getStats }
 */

const AEC_WORKLET_URL = '/audio-worklets/aec-worklet.js';
const AEC_SAMPLE_RATE = 16000;
const DEBUG = typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function aecLog(...args) {
  if (DEBUG) console.info('[Voice/AEC]', ...args);
}

export async function createAecProcessedStream(micStream, existingContext = null, options = {}) {
  const enabled = options.enabled !== false;

  if (!enabled || !micStream) {
    return {
      stream: micStream,
      context: null,
      pushFarEnd: () => {},
      cleanup: () => {},
      getStats: () => ({ mode: 'aec-disabled' }),
    };
  }

  if (typeof window === 'undefined') {
    throw new Error('AEC is only available in the browser.');
  }

  const audioContext = existingContext || new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: 'interactive',
    sampleRate: AEC_SAMPLE_RATE,
  });

  const source = audioContext.createMediaStreamSource(micStream);
  const destination = audioContext.createMediaStreamDestination();
  const nodes = { source, destination };

  let farEndStream = null;     /* stream for capturing playback */
  let farEndSource = null;     /* AudioNode for far-end capture */
  let farEndAnalyser = null;   /* AnalyserNode to capture far-end */
  let farEndRaf = null;        /* animation frame for far-end capture */
  let aecNode = null;          /* the AudioWorkletNode */
  let isRunning = true;

  const farEndBufferSize = 4096;  /* ~256ms at 16kHz */
  let farEndWriteIdx = 0;
  const farEndBuffer = new Float32Array(farEndBufferSize);

  try {
    // ─── Load AEC worklet ──────────────────────────────
    await audioContext.audioWorklet.addModule(AEC_WORKLET_URL);

    aecNode = new AudioWorkletNode(audioContext, 'echo-cancellation-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: {
        tapCount: options.tapCount || 512,
        warmupStep: options.warmupStep || 0.5,
        steadyStep: options.steadyStep || 0.1,
        rho: options.rho || 2.0,
      },
    });
    nodes.aecNode = aecNode;

    // ─── Wait for worklet ready ─────────────────────────
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('AEC worklet init timed out')), 8000);
      aecNode.port.onmessage = (event) => {
        if (event.data?.type === 'ready') {
          clearTimeout(timeout);
          aecLog('AEC worklet ready', event.data);
          resolve();
        }
      };
    });

    // ─── Connect: source → aecNode → destination ──────
    source.connect(aecNode);
    aecNode.connect(destination);

    // ─── Setup far-end (playback) capture chain ────────
    /**
     * Create a stream that the application uses for playback.
     * The AEC needs a reference of what's playing through speakers
     * to cancel it from the mic signal.
     *
     * The user should set this as the stream their app plays:
     *   stream.pushFarEnd(remoteStream)
     *
     * Internally, we create an AnalyserNode to capture far-end samples
     * and push them into the worklet at ~50fps.
     */
    const pushFarEnd = (remoteStream) => {
      if (!remoteStream || !isRunning) return;

      // Close previous far-end capture
      if (farEndSource) {
        try { farEndSource.disconnect(); } catch {}
        farEndSource = null;
      }
      if (farEndRaf) {
        cancelAnimationFrame(farEndRaf);
        farEndRaf = null;
      }

      // Create a new source from the remote stream
      try {
        farEndSource = audioContext.createMediaStreamSource(remoteStream);
        farEndAnalyser = audioContext.createAnalyser();
        farEndAnalyser.fftSize = 1024;
        farEndSource.connect(farEndAnalyser);

        const captureBuffer = new Float32Array(farEndAnalyser.fftSize);

        const captureLoop = () => {
          if (!isRunning) return;
          farEndAnalyser.getFloatTimeDomainData(captureBuffer);

          // Push samples into the far-end buffer and batch-send to worklet
          for (let i = 0; i < captureBuffer.length; i++) {
            farEndBuffer[farEndWriteIdx] = captureBuffer[i];
            farEndWriteIdx = (farEndWriteIdx + 1) % farEndBufferSize;
          }

          // Send a chunk of far-end to the worklet
          // We need to downsample/interpolate to the worklet's expected rate
          const chunkSize = Math.min(captureBuffer.length, 2048);
          const chunk = new Float32Array(chunkSize);
          for (let i = 0; i < chunkSize; i++) {
            chunk[i] = captureBuffer[i];
          }
          aecNode.port.postMessage({ type: 'push-far', samples: chunk });

          farEndRaf = requestAnimationFrame(captureLoop);
        };

        farEndRaf = requestAnimationFrame(captureLoop);
        aecLog('Far-end capture started');
      } catch (err) {
        aecLog('Far-end capture setup failed:', err.message);
      }
    };

    // ─── Stats polling ──────────────────────────────────
    let latestStats = { mode: 'aec', erle: 0, converged: 0 };
    aecNode.port.onmessage = (event) => {
      if (event.data?.type === 'stats') {
        latestStats = { ...latestStats, ...event.data };
      }
    };

    aecLog('AEC processing started');

    return {
      stream: destination.stream,
      context: audioContext,
      pushFarEnd,
      nodes,
      getStats: () => ({ ...latestStats }),
      cleanup: () => {
        isRunning = false;
        if (farEndRaf) cancelAnimationFrame(farEndRaf);
        if (farEndSource) {
          try { farEndSource.disconnect(); } catch {}
        }
        Object.values(nodes).forEach((node) => {
          try { node.disconnect?.(); } catch {}
        });
        destination.stream.getTracks().forEach((t) => {
          // Don't stop original mic tracks — the caller owns them
        });
        if (!existingContext) {
          audioContext.close?.().catch(() => {});
        }
        aecLog('AEC cleanup done');
      },
    };
  } catch (error) {
    aecLog('AEC unavailable, falling back to raw stream:', error.message);
    // Cleanup partial nodes
    Object.values(nodes).forEach((node) => {
      try { node.disconnect?.(); } catch {}
    });
    if (!existingContext) {
      audioContext.close?.().catch(() => {});
    }
    return {
      stream: micStream,
      context: null,
      pushFarEnd: () => {},
      cleanup: () => {},
      getStats: () => ({ mode: 'aec-fallback', error: error.message }),
    };
  }
}
