'use client';

import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';

const DTLN_WORKLET_URL = '/audio-worklets/dtln-noise-suppression-worklet.js';
const DTLN_SAMPLE_RATE = 16000;
const DEBUG = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function createAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('AudioContext is not supported.');
  try {
    return new AudioContextClass({ latencyHint: 'interactive', sampleRate: DTLN_SAMPLE_RATE });
  } catch {
    return new AudioContextClass({ latencyHint: 'interactive' });
  }
}

function createCompressor(audioContext) {
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = VOICE_AUDIO_CONFIG.compressorThreshold;
  compressor.knee.value = VOICE_AUDIO_CONFIG.compressorKnee;
  compressor.ratio.value = VOICE_AUDIO_CONFIG.compressorRatio;
  compressor.attack.value = VOICE_AUDIO_CONFIG.compressorAttack;
  compressor.release.value = VOICE_AUDIO_CONFIG.compressorRelease;
  return compressor;
}

export async function createDtlnNoiseSuppressedStream(rawStream, options = {}) {
  if (!rawStream) {
    return { stream: rawStream, context: null, nodes: {}, cleanup: () => {}, getStats: () => ({}) };
  }
  if (typeof window === 'undefined') {
    throw new Error('DTLN noise suppression is only available in the browser.');
  }

  const audioContext = createAudioContext();
  const source = audioContext.createMediaStreamSource(rawStream);
  const destination = audioContext.createMediaStreamDestination();
  const nodes = { source, destination };
  let latestStats = { mode: 'dtln-ai', ready: false, sampleRate: audioContext.sampleRate, outputChannels: 2 };

  try {
    await audioContext.audioWorklet.addModule(DTLN_WORKLET_URL);

    const denoiser = new AudioWorkletNode(audioContext, 'NoiseSuppressionWorker', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    nodes.denoiser = denoiser;

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('DTLN worklet initialization timed out.')), 8000);
      denoiser.port.onmessage = (event) => {
        if (event.data === 'ready') {
          window.clearTimeout(timeout);
          latestStats = { ...latestStats, ready: true };
          resolve();
          return;
        }
        if (event.data && typeof event.data === 'object') {
          latestStats = {
            ...latestStats,
            ready: true,
            samplesPerSecond: event.data.avg_samples_processed,
            inputSignal: event.data.avg_input_signal,
            outputSignal: event.data.avg_output_signal,
            signalEnhancement: event.data.avg_signal_enhancement,
            signalSuppression: event.data.avg_signal_suppression,
          };
        }
      };
      denoiser.port.onmessageerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('DTLN worklet message failed.'));
      };
    });

    const postGain = audioContext.createGain();
    postGain.gain.value = clamp(options.micGain ?? VOICE_AUDIO_CONFIG.micGain, 1, 2);
    nodes.postGain = postGain;

    const compressor = createCompressor(audioContext);
    nodes.compressor = compressor;

    const stereoMerger = audioContext.createChannelMerger(2);
    nodes.stereoMerger = stereoMerger;

    source.connect(denoiser);
    denoiser.connect(postGain);
    postGain.connect(compressor);
    compressor.connect(stereoMerger, 0, 0);
    compressor.connect(stereoMerger, 0, 1);
    stereoMerger.connect(destination);

    if (DEBUG) {
      console.info('[Voice] DTLN AI noise suppression enabled', {
        sampleRate: audioContext.sampleRate,
        workletUrl: DTLN_WORKLET_URL,
        outputChannels: 2,
      });
    }

    return {
      stream: destination.stream,
      context: audioContext,
      nodes,
      getStats: () => latestStats,
      cleanup: () => {
        Object.values(nodes).forEach((node) => {
          try { node.disconnect?.(); } catch {}
        });
        destination.stream.getTracks().forEach((track) => track.stop());
        audioContext.close?.().catch(() => {});
      },
    };
  } catch (error) {
    Object.values(nodes).forEach((node) => {
      try { node.disconnect?.(); } catch {}
    });
    destination.stream.getTracks().forEach((track) => track.stop());
    audioContext.close?.().catch(() => {});
    throw error;
  }
}
