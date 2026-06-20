'use client';

import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';
import { clamp } from '@/utils/audio/audioHelpers';

const DEBUG = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function mergeOptions(options = {}) {
  return {
    enabled: options.enabled ?? options.noiseSuppressionMode !== 'off',
    highpassEnabled: options.highpassEnabled ?? VOICE_AUDIO_CONFIG.highpassEnabled,
    highpassFrequency: options.highpassFrequency ?? VOICE_AUDIO_CONFIG.highpassFrequency,
    lowpassEnabled: options.lowpassEnabled ?? VOICE_AUDIO_CONFIG.lowpassEnabled,
    lowpassFrequency: options.lowpassFrequency ?? VOICE_AUDIO_CONFIG.lowpassFrequency,
    noiseGateEnabled: options.noiseGateEnabled ?? VOICE_AUDIO_CONFIG.noiseGateEnabled,
    noiseGateThreshold: options.noiseGateThreshold ?? VOICE_AUDIO_CONFIG.noiseGateThreshold,
    noiseGateReduction: options.noiseGateReduction ?? VOICE_AUDIO_CONFIG.noiseGateReduction,
    noiseGateAttackMs: options.noiseGateAttackMs ?? VOICE_AUDIO_CONFIG.noiseGateAttackMs,
    noiseGateReleaseMs: options.noiseGateReleaseMs ?? VOICE_AUDIO_CONFIG.noiseGateReleaseMs,
    noiseGateHoldMs: options.noiseGateHoldMs ?? VOICE_AUDIO_CONFIG.noiseGateHoldMs,
    gainEnabled: options.gainEnabled ?? VOICE_AUDIO_CONFIG.gainEnabled,
    micGain: options.micGain ?? VOICE_AUDIO_CONFIG.micGain,
    compressorEnabled: options.compressorEnabled ?? VOICE_AUDIO_CONFIG.compressorEnabled,
    compressorThreshold: options.compressorThreshold ?? VOICE_AUDIO_CONFIG.compressorThreshold,
    compressorKnee: options.compressorKnee ?? VOICE_AUDIO_CONFIG.compressorKnee,
    compressorRatio: options.compressorRatio ?? VOICE_AUDIO_CONFIG.compressorRatio,
    compressorAttack: options.compressorAttack ?? VOICE_AUDIO_CONFIG.compressorAttack,
    compressorRelease: options.compressorRelease ?? VOICE_AUDIO_CONFIG.compressorRelease,
    limiterEnabled: options.limiterEnabled ?? VOICE_AUDIO_CONFIG.limiterEnabled,
    limiterThreshold: options.limiterThreshold ?? VOICE_AUDIO_CONFIG.limiterThreshold,
    debug: options.debug ?? DEBUG,
  };
}

function getSampleRate(stream) {
  return stream?.getAudioTracks?.()[0]?.getSettings?.().sampleRate || VOICE_AUDIO_CONFIG.sampleRate;
}

function createAudioContext(stream) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('AudioContext is not supported.');
  try {
    return new AudioContextClass({ latencyHint: 'interactive', sampleRate: getSampleRate(stream) });
  } catch {
    return new AudioContextClass({ latencyHint: 'interactive' });
  }
}

function createCompressor(audioContext, options) {
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = options.compressorThreshold;
  compressor.knee.value = options.compressorKnee;
  compressor.ratio.value = options.compressorRatio;
  compressor.attack.value = options.compressorAttack;
  compressor.release.value = options.compressorRelease;
  return compressor;
}

function createLimiter(audioContext, options) {
  const limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = options.limiterThreshold;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  return limiter;
}

function startGateMonitor(audioContext, analyser, gateGain, options) {
  if (!options.noiseGateEnabled) return () => {};
  const data = new Uint8Array(analyser.fftSize);
  let rafId = 0;
  let latestRawLevel = 0;
  let latestProcessedLevel = 0;
  let holdFrames = 0;
  let currentTarget = 1;
  const holdFramesMax = Math.round((options.noiseGateHoldMs || 100) / (1000 / 60)); /* ~60fps */

  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i += 1) {
      const sample = (data[i] - 128) / 128;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    // Hysteresis: once below threshold, hold for N frames before gating
    if (rms < options.noiseGateThreshold) {
      if (holdFrames < holdFramesMax) {
        holdFrames++;
      } else {
        currentTarget = clamp(options.noiseGateReduction, 0.15, 0.85);
      }
    } else {
      holdFrames = 0;
      currentTarget = 1;
    }

    const timeConstant = currentTarget < gateGain.gain.value
      ? options.noiseGateAttackMs / 1000
      : options.noiseGateReleaseMs / 1000;
    gateGain.gain.setTargetAtTime(currentTarget, audioContext.currentTime, Math.max(0.001, timeConstant));
    latestRawLevel = rms;
    latestProcessedLevel = rms * currentTarget;
    rafId = window.requestAnimationFrame(tick);
  };

  rafId = window.requestAnimationFrame(tick);
  return Object.assign(
    () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    },
    {
      getStats: () => ({
        rawAudioLevel: latestRawLevel,
        processedAudioLevel: latestProcessedLevel,
        gateGain: gateGain.gain.value,
      }),
    }
  );
}

export async function createVoiceProcessedStream(rawStream, options = {}) {
  const settings = mergeOptions(options);
  if (!settings.enabled || !rawStream) {
    return { stream: rawStream, context: null, nodes: {}, cleanup: () => {}, getStats: () => ({}) };
  }

  try {
    const audioContext = createAudioContext(rawStream);
    const source = audioContext.createMediaStreamSource(rawStream);
    const destination = audioContext.createMediaStreamDestination();
    const nodes = { source, destination };
    let current = source;

    if (settings.highpassEnabled) {
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = settings.highpassFrequency;
      highpass.Q.value = 0.707;
      current.connect(highpass);
      current = highpass;
      nodes.highpass = highpass;
    }

    // Lowpass filter — cuts high-frequency noise (hiss, fan noise, etc.)
    if (settings.lowpassEnabled) {
      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = settings.lowpassFrequency;
      lowpass.Q.value = 0.707;
      current.connect(lowpass);
      current = lowpass;
      nodes.lowpass = lowpass;
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    current.connect(analyser);
    nodes.analyser = analyser;

    const gateGain = audioContext.createGain();
    gateGain.gain.value = 1;
    current.connect(gateGain);
    current = gateGain;
    nodes.gateGain = gateGain;

    const stopGateMonitor = startGateMonitor(audioContext, analyser, gateGain, settings);

    if (settings.gainEnabled) {
      const micGain = audioContext.createGain();
      micGain.gain.value = clamp(settings.micGain, 1, 2);
      current.connect(micGain);
      current = micGain;
      nodes.micGain = micGain;
    }

    if (settings.compressorEnabled) {
      const compressor = createCompressor(audioContext, settings);
      current.connect(compressor);
      current = compressor;
      nodes.compressor = compressor;
    }

    if (settings.limiterEnabled) {
      const limiter = createLimiter(audioContext, settings);
      current.connect(limiter);
      current = limiter;
      nodes.limiter = limiter;
    }

    current.connect(destination);

    if (settings.debug) {
      console.info('[Voice] Web Audio noise suppression enabled', {
        sampleRate: audioContext.sampleRate,
        highpassFrequency: settings.highpassFrequency,
        lowpassFrequency: settings.lowpassFrequency,
        noiseGateThreshold: settings.noiseGateThreshold,
        noiseGateReduction: settings.noiseGateReduction,
        noiseGateHoldMs: settings.noiseGateHoldMs,
        micGain: settings.micGain,
      });
    }

    return {
      stream: destination.stream,
      context: audioContext,
      nodes,
      getStats: stopGateMonitor.getStats || (() => ({})),
      cleanup: () => {
        stopGateMonitor();
        Object.values(nodes).forEach((node) => {
          try { node.disconnect?.(); } catch {}
        });
        destination.stream.getTracks().forEach((track) => track.stop());
        audioContext.close?.().catch(() => {});
      },
    };
  } catch (error) {
    if (settings.debug) console.warn('[Voice] Web Audio noise suppression fallback to raw stream:', error.message);
    return { stream: rawStream, context: null, nodes: {}, cleanup: () => {}, getStats: () => ({ fallback: true }) };
  }
}
