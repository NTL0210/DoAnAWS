'use client';

import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';

export const VOICE_RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

export const RECORDING_QUALITY_BITRATES = {
  low: 96000,
  standard: 128000,
  high: 128000,
};

const DEFAULT_RECORDING_SETTINGS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  inputVolume: 100,
  localRecordingGain: VOICE_AUDIO_CONFIG.recordingLocalGain,
  remoteRecordingGain: VOICE_AUDIO_CONFIG.recordingRemoteGain,
  recordingQuality: 'high',
  inputSensitivity: 18,
};

function devWarn(...args) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Voice/AudioQuality]', ...args);
  }
}

export function getSupportedVoiceMimeType() {
  return pickAudioMimeType();
}

export function pickAudioMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  return VOICE_RECORDING_MIME_CANDIDATES.find((type) => window.MediaRecorder.isTypeSupported(type)) || '';
}

export function getAudioExtension(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('mpeg')) return 'mp3';
  if (normalized.includes('mp4')) return 'm4a';
  if (normalized.includes('webm')) return 'webm';
  return 'webm';
}

export function getAudioFormatLabel(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('webm') && normalized.includes('opus')) return 'WebM/Opus';
  if (normalized.includes('webm')) return 'WebM';
  if (normalized.includes('mp4')) return 'M4A';
  if (normalized.includes('mpeg')) return 'MP3';
  return mimeType || 'browser default';
}

export function extensionMatchesMime(fileName = '', mimeType = '') {
  if (!fileName || !mimeType) return true;
  return fileName.toLowerCase().endsWith(`.${getAudioExtension(mimeType)}`);
}

export function getRecordingBitrate(settings = {}) {
  if (settings.recordingTestMode === 'RAW_LOCAL_MIC') return 128000;
  const quality = settings.recordingQuality || 'high';
  return RECORDING_QUALITY_BITRATES[quality] || RECORDING_QUALITY_BITRATES.high;
}

export function buildMediaRecorderOptions(settings = {}) {
  const mimeType = pickAudioMimeType();
  const options = {
    audioBitsPerSecond: getRecordingBitrate(settings),
  };
  if (mimeType) options.mimeType = mimeType;
  return options;
}

export function buildAudioConstraints(settings = {}) {
  const next = { ...DEFAULT_RECORDING_SETTINGS, ...settings };
  const supported = typeof navigator !== 'undefined' && navigator.mediaDevices?.getSupportedConstraints
    ? navigator.mediaDevices.getSupportedConstraints()
    : {};
  const audio = {
    deviceId: (next.selectedMicId || next.inputDeviceId) ? { exact: next.selectedMicId || next.inputDeviceId } : undefined,
    channelCount: { ideal: VOICE_AUDIO_CONFIG.channelCount },
    sampleRate: { ideal: VOICE_AUDIO_CONFIG.sampleRate },
    sampleSize: { ideal: VOICE_AUDIO_CONFIG.sampleSize },
    latency: { ideal: VOICE_AUDIO_CONFIG.latency },
  };

  ['echoCancellation', 'noiseSuppression', 'autoGainControl'].forEach((key) => {
    if (supported[key] !== false) {
      audio[key] = Boolean(next[key]);
    } else {
      devWarn(`${key} is not supported by this browser; ignoring constraint.`);
    }
  });

  return {
    audio: Object.fromEntries(Object.entries(audio).filter(([, value]) => value !== undefined)),
  };
}

const LOCAL_COMPRESSOR_SETTINGS = {
  threshold: -20,
  knee: 18,
  ratio: 4,
  attack: 0.003,
  release: 0.20,
};

function getTrackSampleRate(stream) {
  const track = stream?.getAudioTracks?.()[0];
  return track?.getSettings?.().sampleRate || 48000;
}

function createRecordingAudioContext(stream) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('AudioContext is not supported.');
  const sampleRate = getTrackSampleRate(stream);
  try {
    return new AudioContextClass({ latencyHint: 'interactive', sampleRate });
  } catch {
    return new AudioContextClass({ latencyHint: 'interactive' });
  }
}

function applyCompressorSettings(compressor, settings = LOCAL_COMPRESSOR_SETTINGS) {
  compressor.threshold.value = settings.threshold;
  compressor.knee.value = settings.knee;
  compressor.ratio.value = settings.ratio;
  compressor.attack.value = settings.attack;
  compressor.release.value = settings.release;
}

function createHighpassFilter(audioContext) {
  const filter = audioContext.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = VOICE_AUDIO_CONFIG.highpassFrequency;
  filter.Q.value = 0.707;
  return filter;
}

export function createProcessedLocalRecordingStream({ localStream, makeupGain = VOICE_AUDIO_CONFIG.localMicMakeupGain } = {}) {
  if (!localStream) throw new Error('Local recording stream is required.');
  const audioContext = createRecordingAudioContext(localStream);
  const source = audioContext.createMediaStreamSource(localStream);
  const highpass = createHighpassFilter(audioContext);
  const compressor = audioContext.createDynamicsCompressor();
  const gain = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();
  const safeMakeupGain = Math.max(1, Math.min(VOICE_AUDIO_CONFIG.maxRecordingGain, Number(makeupGain) || VOICE_AUDIO_CONFIG.localMicMakeupGain));

  applyCompressorSettings(compressor, LOCAL_COMPRESSOR_SETTINGS);
  gain.gain.value = safeMakeupGain;
  source.connect(highpass);
  highpass.connect(compressor);
  compressor.connect(gain);
  gain.connect(destination);

  return {
    stream: destination.stream,
    audioContext,
    compressor,
    compressorSettings: LOCAL_COMPRESSOR_SETTINGS,
    makeupGain: safeMakeupGain,
    sampleRate: audioContext.sampleRate,
    cleanup: () => {
      try { source.disconnect(); } catch {}
      try { highpass.disconnect(); } catch {}
      try { compressor.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      audioContext.close?.().catch(() => {});
    },
  };
}

/**
 * Create a mixed stream for recording (local mic + remote peers).
 * Speaking indicator boost is intentionally not used here. Each source is
 * staged conservatively, then a compressor/limiter protects MediaRecorder
 * from clipping.
 */
export function createProcessedRecordingStream({ localStream, remoteStreams = [], settings = {} }) {
  const audioContext = createRecordingAudioContext(localStream);
  const destination = audioContext.createMediaStreamDestination();
  const liveRemoteStreams = remoteStreams.filter((stream) =>
    stream?.getAudioTracks?.().some((track) => track.readyState === 'live')
  );

  const sourceNodes = [];
  const masterCompressor = audioContext.createDynamicsCompressor();
  applyCompressorSettings(masterCompressor, LOCAL_COMPRESSOR_SETTINGS);

  const masterLimiter = audioContext.createDynamicsCompressor();
  masterLimiter.threshold.value = -3;
  masterLimiter.knee.value = 0;
  masterLimiter.ratio.value = 20;
  masterLimiter.attack.value = 0.001;
  masterLimiter.release.value = 0.08;
  const masterGain = audioContext.createGain();
  masterGain.gain.value = VOICE_AUDIO_CONFIG.recordingMasterGain;

  masterCompressor.connect(masterLimiter);
  masterLimiter.connect(masterGain);
  masterGain.connect(destination);

  const sourceCount = 1 + liveRemoteStreams.length;
  const mixHeadroom = liveRemoteStreams.length > 0
    ? Math.max(VOICE_AUDIO_CONFIG.mixedRoomMinHeadroom, 1 / Math.sqrt(sourceCount))
    : 1;
  const clampRecordingGain = (value, fallback = 1) => Math.max(0, Math.min(VOICE_AUDIO_CONFIG.maxRecordingGain, Number(value ?? fallback)));

  // Local mic: high-pass rumble, then make-up gain. VAD is intentionally not in this chain.
  const localSource = audioContext.createMediaStreamSource(localStream);
  const localHighpass = createHighpassFilter(audioContext);
  const localGain = audioContext.createGain();
  localGain.gain.value = clampRecordingGain(settings.localRecordingGain, VOICE_AUDIO_CONFIG.recordingLocalGain) * mixHeadroom;
  localSource.connect(localHighpass);
  localHighpass.connect(localGain);
  localGain.connect(masterCompressor);
  sourceNodes.push(localSource, localHighpass, localGain);

  // Remote streams: normalize each source to the same safe headroom.
  const remoteGainValue = clampRecordingGain(settings.remoteRecordingGain, VOICE_AUDIO_CONFIG.recordingRemoteGain) * mixHeadroom;
  const seenStreamIds = new Set();
  liveRemoteStreams.forEach((remoteStream) => {
    if (seenStreamIds.has(remoteStream.id)) return;
    seenStreamIds.add(remoteStream.id);
    const remoteSource = audioContext.createMediaStreamSource(remoteStream);
    const remoteGain = audioContext.createGain();
    remoteGain.gain.value = remoteGainValue;
    remoteSource.connect(remoteGain);
    remoteGain.connect(masterCompressor);
    sourceNodes.push(remoteSource, remoteGain);
  });

  return {
    stream: destination.stream,
    audioContext,
    compressor: masterCompressor,
    compressorSettings: LOCAL_COMPRESSOR_SETTINGS,
    makeupGain: masterGain.gain.value,
    sampleRate: audioContext.sampleRate,
    remoteCount: liveRemoteStreams.length,
    cleanup: () => {
      sourceNodes.forEach((node) => {
        try { node.disconnect(); } catch {}
      });
      try { masterCompressor.disconnect(); } catch {}
      try { masterLimiter.disconnect(); } catch {}
      try { masterGain.disconnect(); } catch {}
      audioContext.close?.().catch(() => {});
    },
  };
}

function measureStreamLevel(analyser, data) {
  analyser.getByteTimeDomainData(data);
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) {
    const sample = (data[i] - 128) / 128;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    sumSquares += sample * sample;
  }
  return { peak, rms: Math.sqrt(sumSquares / data.length) };
}

function getCompressorReduction(compressor) {
  const reduction = compressor?.reduction;
  if (typeof reduction === 'number') return Math.abs(reduction);
  if (typeof reduction?.value === 'number') return Math.abs(reduction.value);
  return 0;
}

export function createRecordingDiagnostics({
  rawStream,
  recordingStream,
  compressor = null,
  label = 'recording',
  intervalMs = 1000,
} = {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const fallback = {
    rawPeak: 0,
    rawRms: 0,
    recordingPeak: 0,
    recordingRms: 0,
    clippingFrames: 0,
    clippingRisk: false,
    compressorReduction: 0,
    chunkCount: 0,
    latestChunkSize: 0,
  };
  if (!AudioContextClass || !recordingStream) {
    return {
      noteChunk: () => {},
      stop: () => fallback,
      getStats: () => fallback,
    };
  }

  const audioContext = new AudioContextClass();
  const nodes = [];
  const createAnalyser = (stream) => {
    if (!stream) return null;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    nodes.push(source, analyser);
    return { analyser, data: new Uint8Array(analyser.fftSize) };
  };
  const raw = createAnalyser(rawStream);
  const recording = createAnalyser(recordingStream);
  let chunkCount = 0;
  let latestChunkSize = 0;
  let clippingFrames = 0;
  let lastStats = fallback;

  const timer = window.setInterval(() => {
    const rawLevel = raw ? measureStreamLevel(raw.analyser, raw.data) : { peak: 0, rms: 0 };
    const recordingLevel = recording ? measureStreamLevel(recording.analyser, recording.data) : { peak: 0, rms: 0 };
    if (recordingLevel.peak >= 0.98) clippingFrames += 1;
    lastStats = {
      rawPeak: rawLevel.peak,
      rawRms: rawLevel.rms,
      recordingPeak: recordingLevel.peak,
      recordingRms: recordingLevel.rms,
      clippingFrames,
      clippingRisk: recordingLevel.peak >= 0.98 || clippingFrames > 2,
      compressorReduction: getCompressorReduction(compressor),
      chunkCount,
      latestChunkSize,
    };
    if (process.env.NODE_ENV === 'development') {
      const warn = lastStats.clippingRisk ? ' CLIPPING_RISK' : '';
      console.info(`[Voice/RecordingDiagnostics] ${label}`, {
        rawPeak: lastStats.rawPeak.toFixed(3),
        rawRms: lastStats.rawRms.toFixed(3),
        recordingPeak: lastStats.recordingPeak.toFixed(3),
        recordingRms: lastStats.recordingRms.toFixed(3),
        compressorReduction: lastStats.compressorReduction.toFixed(2),
        chunkCount,
        latestChunkSize,
        warn,
      });
    }
  }, intervalMs);

  return {
    noteChunk: (size = 0) => {
      chunkCount += 1;
      latestChunkSize = Number(size) || 0;
    },
    getStats: () => lastStats,
    stop: () => {
      window.clearInterval(timer);
      nodes.forEach((node) => {
        try { node.disconnect(); } catch {}
      });
      audioContext.close?.().catch(() => {});
      return lastStats;
    },
  };
}

export function createRecordingLevelMonitor(stream, options = {}) {
  return createRecordingDiagnostics({ recordingStream: stream, ...options });
}
