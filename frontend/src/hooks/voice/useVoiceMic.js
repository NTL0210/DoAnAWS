'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import useVoiceActivity from '@/hooks/useVoiceActivity';
import { buildAudioConstraints } from '@/lib/voiceAudioQuality';
import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';
import { createNoiseSuppressorProcessor } from '@/utils/audio/createNoiseSuppressorProcessor';

/* ─── Debug helpers ───────────────────────────────────────── */
const VOICE_DEBUG = process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function getTrackDebugInfo(stream, label) {
  if (!stream) return { label, hasStream: false };
  const track = stream?.getAudioTracks?.()?.[0];
  return {
    label, hasStream: true,
    trackId: track?.id || 'none', trackLabel: track?.label || 'none',
    enabled: track?.enabled ?? false, muted: track?.muted ?? false,
    readyState: track?.readyState || 'none', settings: track?.getSettings?.(),
  };
}

function logMicDebug(rawStream, processedStream, sendStream, vadStream) {
  if (process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG !== 'true') return;
  console.log('[Voice][Mic] rawMicStream:', getTrackDebugInfo(rawStream, 'raw'));
  console.log('[Voice][Mic] processedMicStream:', getTrackDebugInfo(processedStream, 'processed'));
  console.log('[Voice][Mic] sendStream:', getTrackDebugInfo(sendStream, 'send'));
  console.log('[Voice][Mic] vadStream:', getTrackDebugInfo(vadStream, 'vad'));
}

function debugStreamOnce(stream, label) {
  if (process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG !== 'true') return;
  if (!stream) return;
  if (!debugStreamOnce._seen) debugStreamOnce._seen = new Set();
  if (debugStreamOnce._seen.has(stream.id)) return;
  debugStreamOnce._seen.add(stream.id);
  const track = stream.getAudioTracks()[0];
  console.info(`[Voice] ${label}`, {
    streamId: stream.id, trackId: track?.id, label: track?.label,
    enabled: track?.enabled, muted: track?.muted, readyState: track?.readyState,
    settings: track?.getSettings?.(),
  });
}

function createStaleMicInitError() {
  const error = new Error('[Voice] Stale mic init ignored');
  error.code = 'STALE_MIC_INIT';
  return error;
}

function isStaleMicInitError(error) {
  return error?.code === 'STALE_MIC_INIT' || error?.message === '[Voice] Stale mic init ignored';
}

/**
 * useVoiceMic — manages mic stream lifecycle, mute/deafen/PTT, and VAD integration.
 *
 * @param {Object} params
 * @param {Object|null} params.channel
 * @param {Object|null} params.currentUser
 * @param {boolean} params.joined
 * @param {boolean} params.canManagePermissions
 * @param {Object} params.voiceSettings
 * @param {Function} params.updateSetting
 * @param {Function} params.setLocalStream
 * @param {Function} params.setLocalSpeaking
 * @param {Function} params.setLocalMicMuted
 * @param {Function} params.updateVoiceParticipantState
 * @param {Function} params.showToast
 * @returns {Object} mic state and actions
 */
export default function useVoiceMic({
  channel,
  currentUser,
  joined,
  canManagePermissions,
  voiceSettings,
  updateSetting,
  setLocalStream,
  setLocalSpeaking,
  setLocalMicMuted,
  updateVoiceParticipantState,
  showToast,
}) {
  // ─── Mic stream refs ───────────────────────────────────
  const micStreamRef = useRef(null);
  const liveMicStreamRef = useRef(null);
  const vadStreamRef = useRef(null);
  const audioProcessingRef = useRef(null);
  const audioProcessingStatsRef = useRef(null);
  const rawMicStreamRef = useRef(null);
  const processedMicStreamRef = useRef(null);
  const sendStreamRef = useRef(null);
  const micInitPromiseRef = useRef(null);
  const micGenerationRef = useRef(0);
  const audioProcessingCleanupRef = useRef(null);
  const loggedStreamIdsRef = useRef(new Set());
  const applyMuteRef = useRef(null);
  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  // ─── Mic stream state ──────────────────────────────────
  const [micStream, setMicStream] = useState(null);
  const [vadStream, setVadStream] = useState(null);
  const [processedMicStream, setProcessedMicStream] = useState(null);
  const [audioProcessingStats, setAudioProcessingStats] = useState({});
  const [micTrackWarning, setMicTrackWarning] = useState('');

  // ─── Mute / Push-to-Talk state ─────────────────────────
  const [muted, setMuted] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const previousMutedRef = useRef(false);

  // ─── Audio level ───────────────────────────────────────
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  // ─── Derived: isMicEnabled ─────────────────────────────
  const isMicEnabled = joined && !muted && !voiceSettings.deafen && (!voiceSettings.pushToTalk || pttActive);

  // ─── VAD ───────────────────────────────────────────────
  const {
    isSpeaking,
    audioLevel,
    rawRms,
    peak: vadPeak,
    clippingRisk: vadClippingRisk,
    hasAudioInput: vadHasInput,
  } = useVoiceActivity(isMicEnabled ? vadStream : null, {
    enabled: isMicEnabled,
    isMuted: !isMicEnabled,
    settings: voiceSettings,
    minThreshold: 0.012,
    speakingHoldMs: 250,
    uiUpdateMs: 80,
    sourceLabel: 'local-voice',
  });

  // ─── VAD source tracking ───────────────────────────────
  const vadSourceRef = useRef('none');
  useEffect(() => {
    if (isMicEnabled && vadStream) {
      vadSourceRef.current = !!processedMicStream ? 'processed' : 'raw';
    } else {
      vadSourceRef.current = 'none';
    }
  }, [isMicEnabled, vadStream, processedMicStream]);

  // ─── Audio level meter ─────────────────────────────────
  const localAudioLevelUpdateRef = useRef(null);
  useEffect(() => {
    if (localAudioLevelUpdateRef.current === null) {
      localAudioLevelUpdateRef.current = Date.now();
    }
    setLocalAudioLevel(isMicEnabled ? audioLevel : 0);
    if (isMicEnabled && audioLevel > 0) {
      localAudioLevelUpdateRef.current = Date.now();
    }
  }, [isMicEnabled, audioLevel]);

  // ─── Sync isSpeaking → global + WebRTC ────────────────
  const prevSpeakingRef = useRef(false);
  const prevSyncedAudioLevelRef = useRef(0);
  useEffect(() => {
    const levelChanged = Math.abs(prevSyncedAudioLevelRef.current - localAudioLevel) >= 0.01;
    if (prevSpeakingRef.current !== isSpeaking || levelChanged) {
      prevSpeakingRef.current = isSpeaking;
      prevSyncedAudioLevelRef.current = localAudioLevel;
      if (channel?.id && currentUser?.id) {
        updateVoiceParticipantState(channel.id, currentUser.id, { isSpeaking });
      }
      setLocalSpeaking({ isSpeaking, audioLevel: localAudioLevel });
    }
  }, [isSpeaking, localAudioLevel, channel?.id, currentUser?.id, updateVoiceParticipantState, setLocalSpeaking]);

  // ─── PTT keyboard handler ──────────────────────────────
  useEffect(() => {
    if (!voiceSettings.pushToTalk || !joined) return;
    const handleKeyDown = (e) => { if (e.code === 'Space' && !e.repeat) setPttActive(true); };
    const handleKeyUp = (e) => { if (e.code === 'Space') setPttActive(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setPttActive(false);
    };
  }, [voiceSettings.pushToTalk, joined]);

  // ─── Turn off PTT when disabled ────────────────────────
  useEffect(() => {
    if (!voiceSettings.pushToTalk) setPttActive(false);
  }, [voiceSettings.pushToTalk]);

  // ─── getMicStream ──────────────────────────────────────
  const getMicStream = useCallback(async (settings) => {
    try {
      const constraints = buildAudioConstraints({
        ...settings,
        echoCancellation: settings.echoCancellation ?? VOICE_AUDIO_CONFIG.browserEchoCancellation,
        noiseSuppression: settings.noiseSuppression ?? VOICE_AUDIO_CONFIG.browserNoiseSuppression,
        autoGainControl: settings.autoGainControl ?? VOICE_AUDIO_CONFIG.browserAutoGainControl,
      });
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      debugStreamOnce(stream, 'getUserMedia OK');
      return stream;
    } catch (err) {
      if (VOICE_DEBUG) console.warn('[Voice] getUserMedia failed with selected mic:', err.message);
      try {
        const fallback = await navigator.mediaDevices.getUserMedia(buildAudioConstraints({
          ...settings, selectedMicId: null, inputDeviceId: '',
        }));
        debugStreamOnce(fallback, 'getUserMedia FALLBACK OK');
        return fallback;
      } catch (fallbackErr) {
        console.error('[Voice/PHASE1] Microphone access denied:', fallbackErr.message);
        return null;
      }
    }
  }, []);

  // ─── cleanupLocalMicStream ─────────────────────────────
  const cleanupLocalMicStream = useCallback(() => {
    micGenerationRef.current += 1;
    try { audioProcessingCleanupRef.current?.(); } catch (e) { /* best effort */ }
    audioProcessingCleanupRef.current = null;
    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
      vadStreamRef.current = null;
      setVadStream(null);
    }
    if (processedMicStreamRef.current) {
      processedMicStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
      processedMicStreamRef.current = null;
      setProcessedMicStream(null);
    }
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
      rawMicStreamRef.current = null;
      setMicStream(null);
    }
    sendStreamRef.current = null;
    micInitPromiseRef.current = null;
    liveMicStreamRef.current = null;
    micStreamRef.current = null;
    audioProcessingRef.current = null;
    audioProcessingStatsRef.current = null;
    setAudioProcessingStats({});
    setLocalStream(null);
  }, [setLocalStream]);

  // ─── ensureLocalMicStream ──────────────────────────────
  const ensureLocalMicStream = useCallback(async () => {
    const existingTrack = rawMicStreamRef.current?.getAudioTracks?.()?.[0];
    if (existingTrack?.readyState === 'live') {
      return { rawStream: rawMicStreamRef.current, sendStream: sendStreamRef.current || rawMicStreamRef.current };
    }
    if (micInitPromiseRef.current) return micInitPromiseRef.current;

    const generation = micGenerationRef.current + 1;
    micGenerationRef.current = generation;

    const initPromise = (async () => {
      let rawStream;
      try {
        rawStream = await navigator.mediaDevices.getUserMedia(buildAudioConstraints(voiceSettingsRef.current || {}));
      } catch (_err) {
        rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (generation !== micGenerationRef.current) {
        rawStream.getTracks().forEach((t) => { if (t.readyState !== 'ended') t.stop(); });
        throw createStaleMicInitError();
      }
      debugStreamOnce(rawStream, 'ensureLocalMicStream OK');
      rawMicStreamRef.current = rawStream;

      let sendStream = rawStream;
      try {
        const processor = await createNoiseSuppressorProcessor(rawStream, {
          ...VOICE_AUDIO_CONFIG, ...voiceSettings,
          micGain: voiceSettings.micGain ?? voiceSettings.micBoost ?? VOICE_AUDIO_CONFIG.micGain,
          noiseGateThreshold: voiceSettings.noiseGateThreshold ?? VOICE_AUDIO_CONFIG.noiseGateThreshold,
          noiseGateReduction: voiceSettings.noiseGateReduction ?? VOICE_AUDIO_CONFIG.noiseGateReduction,
        });
        if (processor?.stream) sendStream = processor.stream;
        audioProcessingCleanupRef.current = processor?.cleanup || null;
      } catch (_err) { /* fallback to raw */ }

      processedMicStreamRef.current = sendStream === rawStream ? null : sendStream;
      sendStreamRef.current = sendStream;
      micStreamRef.current = rawStream;
      liveMicStreamRef.current = sendStream;
      audioProcessingRef.current = null;
      audioProcessingStatsRef.current = null;
      vadStreamRef.current = rawStream;
      setVadStream(rawStream);
      setMicTrackWarning('');
      setMicStream(rawStream);
      setProcessedMicStream(sendStream === rawStream ? null : sendStream);
      setLocalStream(sendStream);
      return { rawStream, sendStream };
    })();
    micInitPromiseRef.current = initPromise;
    try { return await initPromise; }
    finally {
      if (micInitPromiseRef.current === initPromise) micInitPromiseRef.current = null;
    }
  }, [setLocalStream, voiceSettings]);

  // ─── setActiveMicStream ────────────────────────────────
  const setActiveMicStream = useCallback(async (stream, settings = {}) => {
    if (!stream) return;
    const [rawTrack] = stream.getAudioTracks();
    if (!rawTrack || rawTrack.readyState !== 'live') {
      setMicTrackWarning('Microphone track ended. Choose another input device and rejoin voice.');
      return;
    }
    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach((track) => track.stop());
      vadStreamRef.current = null;
    }
    const vadTrack = rawTrack.clone();
    const nextVadStream = new MediaStream([vadTrack]);
    const handleTrackEnded = () => {
      setMicTrackWarning('Microphone track ended. Choose another input device and rejoin voice.');
      setLocalSpeaking({ isSpeaking: false, audioLevel: 0 });
      setLocalAudioLevel(0);
    };
    rawTrack.addEventListener?.('ended', handleTrackEnded, { once: true });
    vadTrack.addEventListener?.('ended', handleTrackEnded, { once: true });
    audioProcessingRef.current?.cleanup?.();
    audioProcessingRef.current = null;
    audioProcessingStatsRef.current = null;

    let sendStream = stream;
    try {
      const processor = await createNoiseSuppressorProcessor(stream, {
        ...VOICE_AUDIO_CONFIG, ...settings,
        noiseSuppressionMode: settings.noiseSuppressionMode || VOICE_AUDIO_CONFIG.noiseSuppressionMode,
        micGain: settings.micGain ?? settings.micBoost ?? VOICE_AUDIO_CONFIG.micGain,
        noiseGateThreshold: settings.noiseGateThreshold ?? VOICE_AUDIO_CONFIG.noiseGateThreshold,
        noiseGateReduction: settings.noiseGateReduction ?? VOICE_AUDIO_CONFIG.noiseGateReduction,
      });
      sendStream = processor.stream || stream;
      audioProcessingRef.current = processor;
      audioProcessingStatsRef.current = processor.getStats || null;
      setAudioProcessingStats(processor.getStats?.() || { mode: settings.noiseSuppressionMode });
    } catch (error) {
      console.warn('[Voice] noise suppressor unavailable, using browser-only audio:', error.message);
    }

    micStreamRef.current = stream;
    liveMicStreamRef.current = sendStream;
    vadStreamRef.current = nextVadStream;
    setMicTrackWarning('');
    setMicStream(stream);
    setVadStream(nextVadStream);
    setProcessedMicStream(sendStream === stream ? null : sendStream);
    setLocalStream(sendStream);
  }, [setLocalSpeaking, setLocalStream]);

  // ─── applyMute ─────────────────────────────────────────
  const applyMute = useCallback((shouldMute) => {
    const streams = [micStreamRef.current, liveMicStreamRef.current].filter(Boolean);
    streams.forEach((stream) => {
      stream.getAudioTracks().forEach((track) => { track.enabled = !shouldMute; });
    });
    if (vadStreamRef.current) {
      vadStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = !shouldMute; });
    }
    setLocalMicMuted(shouldMute);
    if (channel?.id && currentUser?.id) {
      updateVoiceParticipantState(channel.id, currentUser.id, {
        isMuted: shouldMute,
        isSpeaking: shouldMute ? false : undefined,
      });
    }
  }, [channel?.id, currentUser?.id, updateVoiceParticipantState, setLocalMicMuted]);

  useEffect(() => { applyMuteRef.current = applyMute; }, [applyMute]);

  // ─── Audio processing stats polling ────────────────────
  useEffect(() => {
    if (!audioProcessingStatsRef.current) return undefined;
    const interval = window.setInterval(() => {
      setAudioProcessingStats(audioProcessingStatsRef.current?.() || {});
    }, 500);
    return () => window.clearInterval(interval);
  }, [processedMicStream]);

  // ─── toggleMute ────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setMuted((prev) => { const next = !prev; applyMute(next); return next; });
  }, [applyMute]);

  // ─── toggleDeafen ──────────────────────────────────────
  const toggleDeafen = useCallback(() => {
    const currentlyDeafened = voiceSettings.deafen;
    if (!currentlyDeafened) previousMutedRef.current = muted;
    updateSetting('deafen', !currentlyDeafened);
  }, [updateSetting, voiceSettings.deafen, muted]);

  // ─── Voice mute/deafen custom event shortcuts ──────────
  useEffect(() => {
    const handleMuteShortcut = () => { if (joined) toggleMute(); };
    const handleDeafenShortcut = () => { if (joined) toggleDeafen(); };
    window.addEventListener('workspace:voice-mute-toggle', handleMuteShortcut);
    window.addEventListener('workspace:voice-deafen-toggle', handleDeafenShortcut);
    return () => {
      window.removeEventListener('workspace:voice-mute-toggle', handleMuteShortcut);
      window.removeEventListener('workspace:voice-deafen-toggle', handleDeafenShortcut);
    };
  }, [joined, toggleDeafen, toggleMute]);

  // ─── Deafen effect on mute state ───────────────────────
  useEffect(() => {
    if (voiceSettings.deafen) {
      setMuted(true);
      applyMuteRef.current?.(true);
    } else {
      setMuted(previousMutedRef.current);
      applyMuteRef.current?.(previousMutedRef.current);
    }
  }, [voiceSettings.deafen]);

  // ─── Cleanup on unmount ────────────────────────────────
  useEffect(() => {
    return () => { cleanupLocalMicStream(); };
  }, [cleanupLocalMicStream]);

  return {
    // State
    micStream, vadStream, processedMicStream,
    audioProcessingStats, micTrackWarning,
    muted, pttActive, localAudioLevel,
    isMicEnabled, isSpeaking, audioLevel,
    rawRms, vadPeak, vadClippingRisk, vadHasInput,
    // Refs (for other hooks to access)
    sendStreamRef, liveMicStreamRef, micStreamRef, rawMicStreamRef,
    processedMicStreamRef, vadStreamRef, audioProcessingCleanupRef,
    audioProcessingRef, audioProcessingStatsRef,
    applyMuteRef, micInitPromiseRef,
    // Setters
    setMuted, setPttActive,
    // Actions
    getMicStream, ensureLocalMicStream,
    setActiveMicStream, cleanupLocalMicStream,
    applyMute, toggleMute, toggleDeafen,
    // Refs for debug panel
    localAudioLevelUpdateRef,
    vadSourceRef,
    logMicDebug: () => logMicDebug(
      rawMicStreamRef.current, processedMicStreamRef.current,
      sendStreamRef.current, vadStreamRef.current
    ),
    isStaleMicInitError,
  };
}
