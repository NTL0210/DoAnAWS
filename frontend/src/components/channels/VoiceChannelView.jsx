'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useVoiceConnection } from '@/context/VoiceConnectionContext';
import useVoiceActivity from '@/hooks/useVoiceActivity';
import usePersistentVoiceSettings from '@/hooks/usePersistentVoiceSettings';
import {
  buildAudioConstraints,
  extensionMatchesMime,
} from '@/lib/voiceAudioQuality';
import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';
import { createNoiseSuppressorProcessor } from '@/utils/audio/createNoiseSuppressorProcessor';
import { AUDIO_PROCESSING_STATUS, AUDIO_TARGET_FORMAT } from '@/domain/models/AudioProcessingJob';
import {
  cancelAudioProcessingJob,
  createAudioProcessingJob,
  getAudioProcessingJob,
  retryAudioProcessingJob,
} from '@/services/audioProcessingService';
import VoiceParticipant from './VoiceParticipant';
import NetworkStatusBadge, { getNetworkQuality } from './NetworkStatusBadge';
import RemoteAudioRenderer from './RemoteAudioRenderer';
import VoiceDebugPanel from './VoiceDebugPanel';
import VoiceQualitySettingsPanel from './VoiceQualitySettingsPanel';
import ConfirmModal from './voice-channel/ConfirmModal';
import VoicePermissionModal from './voice-channel/VoicePermissionModal';
import VoiceSettingsModal from './voice-channel/VoiceSettingsModal';

/* ─── Debug helpers ───────────────────────────────────────── */
const VOICE_DEBUG = process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function getTrackDebugInfo(stream, label) {
  if (!stream) return { label, hasStream: false };
  const track = stream?.getAudioTracks?.()?.[0];
  return {
    label,
    hasStream: true,
    trackId: track?.id || 'none',
    trackLabel: track?.label || 'none',
    enabled: track?.enabled ?? false,
    muted: track?.muted ?? false,
    readyState: track?.readyState || 'none',
    settings: track?.getSettings?.(),
  };
}

function logMicDebug(rawStream, processedStream, sendStream, vadStream) {
  if (process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG !== 'true') return;
  console.log('[Voice][Mic] rawMicStream:', getTrackDebugInfo(rawStream, 'raw'));
  console.log('[Voice][Mic] processedMicStream:', getTrackDebugInfo(processedStream, 'processed'));
  console.log('[Voice][Mic] sendStream:', getTrackDebugInfo(sendStream, 'send'));
  console.log('[Voice][Mic] vadStream:', getTrackDebugInfo(vadStream, 'vad'));
}

/** Log each streamId at most once — prevents debug spam from render loops. */
function debugStreamOnce(stream, label) {
  if (process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG !== 'true') return;
  if (!stream) return;
  // Use a module-level weak cache to persist across renders
  if (!debugStreamOnce._seen) debugStreamOnce._seen = new Set();
  if (debugStreamOnce._seen.has(stream.id)) return;
  debugStreamOnce._seen.add(stream.id);
  const track = stream.getAudioTracks()[0];
  console.info(`[Voice] ${label}`, {
    streamId: stream.id,
    trackId: track?.id,
    label: track?.label,
    enabled: track?.enabled,
    muted: track?.muted,
    readyState: track?.readyState,
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
import {
  formatAudioFormat,
  formatBytes,
  formatDuration,
  formatTime,
  getDisplayName,
  getInitials,
} from './voice-channel/voiceFormatters';
import {
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiDownload,
  FiHeadphones,
  FiLock,
  FiMic,
  FiMicOff,
  FiMoreHorizontal,
  FiSettings,
  FiTrash2,
  FiUsers,
  FiVolume2,
  FiWifi,
  FiWifiOff,
  FiX,
  FiZap,
  FiRadio,
} from 'react-icons/fi';

export default function VoiceChannelView({ channel: propChannel }) {
  const {
    activeChannel,
    workspaceMembers,
    workspaceTeams,
    currentUser,
    workspaceRole,
    workspaceRoleLabels,
    voiceParticipants,
    activeVoiceRecordings,
    voiceRecords,
    maxVoiceRecordingSizeBytes,
    warningVoiceRecordingSizeBytes,
    canAccessVoice,
    canRecordVoice,
    joinVoiceChannel,
    leaveVoiceChannel,
    switchVoiceChannel,
    activeVoiceChannelId,
    startVoiceRecording,
    stopVoiceRecording,
    getActiveVoiceRecordingMetrics,
    sendVoiceRecordToAI,
    deleteVoiceRecord,
    updateVoiceChannelPermissions,
    updateVoiceParticipantState,
    syncVoiceParticipant,
    removeVoiceParticipant,
  } = useWorkspace();

  const {
    voiceConnected,
    connectionQuality,
    voiceConnectionState,
    signalingStatus,
    voicePeerStatus,
    micStatus,
    socketLatencyMs,
    lastSocketEvent,
    voiceJoinChannel,
    voiceLeaveChannel,
    remoteStreams,
    remoteParticipants,
    audioWarning,
    hasRemotePeers,
    peerStates,
    peerCount,
    turnConfigured,
    stunConfigured,
    lastWebRTCError,
    localStream: webrtcStream,
    setLocalStream,
    setLocalSpeaking,
    setLocalMicMuted,
    localMicMuted,
  } = useVoiceConnection();

  const channel = propChannel || activeChannel;

  // ─── Voice Settings ──────────────────────────────────────
  const { settings: voiceSettings, updateSetting, setPerUserVolume } = usePersistentVoiceSettings(currentUser?.id, channel?.workspaceId);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  // ─── Mic stream for VAD + WebRTC send ───────────────────
  // rawMicStream is the single source of truth — no separate processed stream.
  const micStreamRef = useRef(null);
  const liveMicStreamRef = useRef(null);
  const vadStreamRef = useRef(null);
  const audioProcessingRef = useRef(null);
  const audioProcessingStatsRef = useRef(null);
  const [micStream, setMicStream] = useState(null);
  const [vadStream, setVadStream] = useState(null);
  const [processedMicStream, setProcessedMicStream] = useState(null);
  const [audioProcessingStats, setAudioProcessingStats] = useState({});
  const [micTrackWarning, setMicTrackWarning] = useState('');

  // ─── Join coordination guard ──────────────────────────────
  const joiningRef = useRef(false);

  // ─── Stable stream refs (no deps, no render cycles) ──────
  const rawMicStreamRef = useRef(null);
  const processedMicStreamRef = useRef(null);
  const sendStreamRef = useRef(null);
  const micInitPromiseRef = useRef(null);
  const micGenerationRef = useRef(0);
  const audioProcessingCleanupRef = useRef(null);
  const loggedStreamIdsRef = useRef(new Set());
  // Stable ref to applyMute so effects can call it without adding it as a dep
  const applyMuteRef = useRef(null);
  // The last settings hash — used to detect real mic-replacement events
  const lastDeviceSettingsHashRef = useRef('');
  // Guard to prevent re-entrant replaceJoinedMic execution
  const replaceMicGuardRef = useRef(false);

  // ─── Mute / Push-to-Talk state ───────────────────────────
  const [muted, setMuted] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const previousMutedRef = useRef(false); // saved mute state before deafen

  // ─── Audio level for meter (local, not global) ───────────
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  // ─── UI State ───────────────────────────────────────────
  const [consentOpen, setConsentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isStartingRawRecording, setIsStartingRawRecording] = useState(false);
  const [processingJobs, setProcessingJobs] = useState({});
  const [recordingMetrics, setRecordingMetrics] = useState({ durationSeconds: 0, estimatedSizeBytes: 0 });
  const [playbackGainByRecord, setPlaybackGainByRecord] = useState({});
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState(null);
  const [pendingRecordingAction, setPendingRecordingAction] = useState(null);

  // ─── Derived data ───────────────────────────────────────
  const participants = voiceParticipants[channel?.id] || [];
  const activeRecording = activeVoiceRecordings[channel?.id] || null;
  const records = voiceRecords.filter((record) =>
    record.workspaceId === channel?.workspaceId || !channel?.workspaceId
      ? record.channelId === channel?.id && record.status !== 'DELETED'
      : false
  );
  const canAccess = channel ? canAccessVoice(channel) : false;
  const canRecord = channel ? canRecordVoice(channel) : false;
  const joined = participants.some((participant) => participant.userId === currentUser?.id);
  const canManagePermissions = ['OWNER', 'VICE_ADMIN'].includes(workspaceRole);
  const recorder = activeRecording
    ? workspaceMembers.find((member) => member.userId === activeRecording.startedBy)
    : null;

  // Local participant for quick lookup
  const localParticipant = participants.find((p) => p.userId === currentUser?.id);

  // ─── Sync remote participant metadata to global context ────
  // audioLevel is deliberately excluded — realtime level lives in
  // VoiceConnectionContext.remoteParticipants and local state only.
  // This effect does NOT depend on `participants` (voiceParticipants from
  // WorkspaceContext) to avoid the render loop: sync → setVoiceParticipants →
  // new participants array → effect re-fires → infinite loop.
  useEffect(() => {
    if (!channel?.id || !remoteParticipants) return;
    remoteParticipants.forEach((participant, userId) => {
      if (!userId || userId === currentUser?.id) return;
      syncVoiceParticipant(channel.id, {
        userId,
        name: participant.name,
        role: participant.role,
        isMuted: participant.isMuted,
        isSpeaking: participant.isSpeaking,
        // NO audioLevel — realtime per-frame data does not belong in global context
      });
    });
  }, [channel?.id, currentUser?.id, remoteParticipants, syncVoiceParticipant]);

  // ─── Clean up stale participants (left the channel) ─────────
  // Separated from the sync effect so participant-list changes from
  // syncVoiceParticipant do NOT re-trigger the sync loop.
  useEffect(() => {
    if (!channel?.id || !remoteParticipants || !joined) return;
    const remoteUserIds = new Set(remoteParticipants.keys());
    participants.forEach((participant) => {
      if (participant.userId !== currentUser?.id && !remoteUserIds.has(participant.userId)) {
        removeVoiceParticipant(channel.id, participant.userId);
      }
    });
  }, [channel?.id, currentUser?.id, joined, participants, remoteParticipants, removeVoiceParticipant]);

  // Compute whether mic is effectively enabled for VAD
  const isMicEnabled = joined && !muted && !voiceSettings.deafen && (!voiceSettings.pushToTalk || pttActive);

  // ─── VAD — only run when mic is enabled and joined ──────
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

  // Track which stream VAD is reading from — for debug panel
  const vadSourceRef = useRef('none');
  useEffect(() => {
    if (isMicEnabled && vadStream) {
      const isProcessed = !!processedMicStream;
      vadSourceRef.current = isProcessed ? 'processed' : 'raw';
    } else {
      vadSourceRef.current = 'none';
    }
  }, [isMicEnabled, vadStream, processedMicStream]);

  // ─── Audio level meter ───────────────────────────────────
  const localAudioLevelUpdateRef = useRef(Date.now());
  useEffect(() => {
    setLocalAudioLevel(isMicEnabled ? audioLevel : 0);
    if (isMicEnabled && audioLevel > 0) {
      localAudioLevelUpdateRef.current = Date.now();
    }
  }, [isMicEnabled, audioLevel]);
  // ─── Sync isSpeaking to global + WebRTC participant state ──
  // audioLevel is synced to WebRTC peers (for remote meters) but NOT to
  // WorkspaceContext voiceParticipants — the global context only needs
  // the speaking toggle for sidebar indicators. This avoids triggering
  // setVoiceParticipants on every VAD frame.
  const prevSpeakingRef = useRef(false);
  const prevSyncedAudioLevelRef = useRef(0);
  useEffect(() => {
    const levelChanged = Math.abs(prevSyncedAudioLevelRef.current - localAudioLevel) >= 0.01;
    if (prevSpeakingRef.current !== isSpeaking || levelChanged) {
      prevSpeakingRef.current = isSpeaking;
      prevSyncedAudioLevelRef.current = localAudioLevel;
      if (channel?.id && currentUser?.id) {
        // Only sync isSpeaking toggle to global context — audioLevel is realtime
        updateVoiceParticipantState(channel.id, currentUser.id, { isSpeaking });
      }
      // Push to WebRTC context (broadcasts via DataChannel + socket fallback)
      setLocalSpeaking({ isSpeaking, audioLevel: localAudioLevel });
    }
  }, [isSpeaking, localAudioLevel, channel?.id, currentUser?.id, updateVoiceParticipantState, setLocalSpeaking]);

  // ─── Push-to-Talk keyboard handler ─────────────────────
  useEffect(() => {
    if (!voiceSettings.pushToTalk || !joined) return;

    const handleKeyDown = (e) => {
      // Space key for push-to-talk
      if (e.code === 'Space' && !e.repeat) {
        setPttActive(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setPttActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setPttActive(false);
    };
  }, [voiceSettings.pushToTalk, joined]);

  // ─── Get mic stream with constraints ─────────────────────
  const getMicStream = useCallback(async (settings) => {
    try {
      // Phase 1: Simple constraints — no buildAudioConstraints wrapping.
      // Using raw constraints avoids deviceId stale-reference errors and
      // Object.fromEntries compatibility issues.
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
      // Selected mic might be unavailable — try default
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true') {
        console.warn('[Voice] getUserMedia failed with selected mic:', err.message);
      }
      try {
        setPermissionMessage('Selected microphone unavailable, using default microphone.');
        const fallback = await navigator.mediaDevices.getUserMedia(buildAudioConstraints({
          ...settings,
          selectedMicId: null,
          inputDeviceId: '',
        }));
        debugStreamOnce(fallback, 'getUserMedia FALLBACK OK');
        return fallback;
      } catch (fallbackErr) {
        console.error('[Voice/PHASE1] Microphone access denied:', fallbackErr.message);
        return null;
      }
    }
  }, []);

  // ─── Cleanup local mic streams (ref-based, no deps) ────
  const cleanupLocalMicStream = useCallback(() => {
    // Bump generation to orphan any in-flight init
    micGenerationRef.current += 1;
    // Clean up Web Audio processing
    try { audioProcessingCleanupRef.current?.(); } catch (e) { /* best effort */ }
    audioProcessingCleanupRef.current = null;
    // Stop vad stream
    if (vadStreamRef.current) {
      vadStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
      vadStreamRef.current = null;
      setVadStream(null);
    }
    // Stop processed stream
    if (processedMicStreamRef.current) {
      processedMicStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
      processedMicStreamRef.current = null;
      setProcessedMicStream(null);
    }
    // Stop raw stream
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
      rawMicStreamRef.current = null;
      setMicStream(null);
    }
    sendStreamRef.current = null;
    micInitPromiseRef.current = null;
    // Sync old refs for backward compat
    liveMicStreamRef.current = null;
    micStreamRef.current = null;
    audioProcessingRef.current = null;
    audioProcessingStatsRef.current = null;
    setAudioProcessingStats({});
    setLocalStream(null);
  }, [setLocalStream]);

  // ─── Ref-based mic init — only calls getUserMedia when no live track exists ──
  const ensureLocalMicStream = useCallback(async () => {
    // Fast path: existing track is live
    const existingTrack = rawMicStreamRef.current?.getAudioTracks?.()?.[0];
    if (existingTrack?.readyState === 'live') {
      return {
        rawStream: rawMicStreamRef.current,
        sendStream: sendStreamRef.current || rawMicStreamRef.current,
      };
    }
    // Deduplicate concurrent calls
    if (micInitPromiseRef.current) return micInitPromiseRef.current;

    const generation = micGenerationRef.current + 1;
    micGenerationRef.current = generation;

    const initPromise = (async () => {
      let rawStream;
      try {
        rawStream = await navigator.mediaDevices.getUserMedia(buildAudioConstraints(voiceSettingsRef.current || {}));
      } catch (_err) {
        // Fallback: no constraints
        rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Stale guard — a newer generation started
      if (generation !== micGenerationRef.current) {
        rawStream.getTracks().forEach((t) => { if (t.readyState !== 'ended') t.stop(); });
        throw createStaleMicInitError();
      }

      debugStreamOnce(rawStream, 'ensureLocalMicStream OK');
      rawMicStreamRef.current = rawStream;

      // Try Web Audio processing
      let sendStream = rawStream;
      try {
        const currentVoiceSettings = voiceSettingsRef.current || {};
        const processor = await createNoiseSuppressorProcessor(rawStream, {
          ...VOICE_AUDIO_CONFIG,
          ...currentVoiceSettings,
          micGain: currentVoiceSettings.micGain ?? currentVoiceSettings.micBoost ?? VOICE_AUDIO_CONFIG.micGain,
          noiseGateThreshold: currentVoiceSettings.noiseGateThreshold ?? VOICE_AUDIO_CONFIG.noiseGateThreshold,
          noiseGateReduction: currentVoiceSettings.noiseGateReduction ?? VOICE_AUDIO_CONFIG.noiseGateReduction,
        });
        if (processor?.stream) sendStream = processor.stream;
        audioProcessingCleanupRef.current = processor?.cleanup || null;
      } catch (_err) {
        // Fallback to raw stream
      }

      processedMicStreamRef.current = sendStream === rawStream ? null : sendStream;
      sendStreamRef.current = sendStream;

      // Sync old refs for backward compat
      micStreamRef.current = rawStream;
      liveMicStreamRef.current = sendStream;
      audioProcessingRef.current = null;
      audioProcessingStatsRef.current = null;

      // Sync VAD stream — use raw stream (no clone needed, AudioContext reads
      // the track data without consuming it)
      vadStreamRef.current = rawStream;
      setVadStream(rawStream);

      // Sync React state for UI
      setMicTrackWarning('');
      setMicStream(rawStream);
      setProcessedMicStream(sendStream === rawStream ? null : sendStream);
      setLocalStream(sendStream);

      return { rawStream, sendStream };
    })();
    micInitPromiseRef.current = initPromise;

    try {
      return await initPromise;
    } finally {
      if (micInitPromiseRef.current === initPromise) {
        micInitPromiseRef.current = null;
      }
    }
  }, [setLocalStream]);

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
    // Use the raw getUserMedia stream directly for both VAD and WebRTC.
    // No Web Audio processing for live stream — this avoids AudioContext
    // lifecycle conflicts with the recording pipeline.
    audioProcessingRef.current?.cleanup?.();
    audioProcessingRef.current = null;
    audioProcessingStatsRef.current = null;

    let sendStream = stream;
    const noiseSuppressionMode = settings.noiseSuppressionMode || VOICE_AUDIO_CONFIG.noiseSuppressionMode;
    try {
      const processor = await createNoiseSuppressorProcessor(stream, {
        ...VOICE_AUDIO_CONFIG,
        ...settings,
        noiseSuppressionMode,
        enabled: noiseSuppressionMode === 'browser-plus-webaudio' || noiseSuppressionMode === 'future-krisp',
        micGain: settings.micGain ?? settings.micBoost ?? VOICE_AUDIO_CONFIG.micGain,
        noiseGateThreshold: settings.noiseGateThreshold ?? VOICE_AUDIO_CONFIG.noiseGateThreshold,
        noiseGateReduction: settings.noiseGateReduction ?? VOICE_AUDIO_CONFIG.noiseGateReduction,
      });
      sendStream = processor.stream || stream;
      audioProcessingRef.current = processor;
      audioProcessingStatsRef.current = processor.getStats || null;
      setAudioProcessingStats(processor.getStats?.() || { mode: noiseSuppressionMode });
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

  // ─── Apply mute/unmute to audio track ──────────────────
  const applyMute = useCallback((shouldMute) => {
    // Both refs point to the same raw stream after rollback — use whichever is available
    const streams = [micStreamRef.current, liveMicStreamRef.current].filter(Boolean);
    streams.forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !shouldMute;
      });
    });
    if (vadStreamRef.current) {
      vadStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !shouldMute;
      });
    }
    // Sync mute state to WebRTC (broadcasts to remote peers)
    setLocalMicMuted(shouldMute);
    if (channel?.id && currentUser?.id) {
      updateVoiceParticipantState(channel.id, currentUser.id, {
        isMuted: shouldMute,
        isSpeaking: shouldMute ? false : undefined,
      });
    }
  }, [channel?.id, currentUser?.id, updateVoiceParticipantState, setLocalMicMuted]);

  // Keep applyMuteRef in sync so effects can call applyMute without a dep dependency
  useEffect(() => { applyMuteRef.current = applyMute; }, [applyMute]);

  useEffect(() => {
    if (!audioProcessingStatsRef.current) return undefined;
    const interval = window.setInterval(() => {
      setAudioProcessingStats(audioProcessingStatsRef.current?.() || {});
    }, 500);
    return () => window.clearInterval(interval);
  }, [processedMicStream]);

  // ─── Toggle mute ────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      applyMute(next);
      return next;
    });
  }, [applyMute]);

  const toggleDeafen = useCallback(() => {
    const currentlyDeafened = voiceSettings.deafen;
    if (!currentlyDeafened) {
      // Save current mute state before deafening — restore it on undeafen
      previousMutedRef.current = muted;
    }
    updateSetting('deafen', !currentlyDeafened);
  }, [updateSetting, voiceSettings.deafen, muted]);

  useEffect(() => {
    const handleMuteShortcut = () => {
      if (joined) toggleMute();
    };
    const handleDeafenShortcut = () => {
      if (joined) toggleDeafen();
    };
    window.addEventListener('workspace:voice-mute-toggle', handleMuteShortcut);
    window.addEventListener('workspace:voice-deafen-toggle', handleDeafenShortcut);
    return () => {
      window.removeEventListener('workspace:voice-mute-toggle', handleMuteShortcut);
      window.removeEventListener('workspace:voice-deafen-toggle', handleDeafenShortcut);
    };
  }, [joined, toggleDeafen, toggleMute]);

  useEffect(() => {
    if (voiceSettings.deafen) {
      // Deafen ON — force mute mic
      setMuted(true);
      applyMuteRef.current?.(true);
    } else {
      // Deafen OFF — restore mic to state before deafen
      setMuted(previousMutedRef.current);
      applyMuteRef.current?.(previousMutedRef.current);
    }
  }, [voiceSettings.deafen]);

  // ─── Join Voice ─────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    setPermissionMessage('');
    let result = await switchVoiceChannel(channel.id);
    if (result?.needsStopConfirm) {
      const confirmed = window.confirm('You are currently recording in another voice channel. Switching will stop the recording and save it. Continue?');
      if (!confirmed) { joiningRef.current = false; return; }
      result = await switchVoiceChannel(channel.id, { confirmedStopRecording: true });
    }
    if (result?.needsConsent) {
      joiningRef.current = false;
      setConsentOpen(true);
      return;
    }
    if (result?.reason === 'NO_ACCESS') {
      joiningRef.current = false;
      setPermissionMessage('You do not have access to this voice channel.');
      return;
    }
    if (result?.ok) {
      // Use ref-based ensure — only calls getUserMedia if no live track exists
      try {
        const { sendStream } = await ensureLocalMicStream();
        // Re-apply current mute/deafen state to freshly created streams
        if (muted || voiceSettings.deafen) {
          applyMuteRef.current?.(true);
        }
        // Debug: log stream info
        if (VOICE_DEBUG) {
          logMicDebug(rawMicStreamRef.current, processedMicStreamRef.current, sendStreamRef.current, vadStreamRef.current);
        }
      } catch (err) {
        if (!isStaleMicInitError(err)) {
          console.error('[Voice] Failed to init mic:', err);
        }
      }
      // Join via WebRTC + signaling
      voiceJoinChannel(channel.id);
    }
    joiningRef.current = false;
  }, [channel?.id, ensureLocalMicStream, voiceSettings, voiceJoinChannel, switchVoiceChannel, muted]);

  // ─── Safety net: ensure mic stream when user is already joined ──
  // Only re-arms when join state changes, NOT when mute/settings change.
  // Mute/deafen state is applied by the dedicated mute/deafen effects.
  const voiceJoinChannelRef = useRef(voiceJoinChannel);
  useEffect(() => { voiceJoinChannelRef.current = voiceJoinChannel; }, [voiceJoinChannel]);
  useEffect(() => {
    let cancelled = false;
    const ensureJoinedStream = async () => {
      if (joiningRef.current || rawMicStreamRef.current || !joined || activeVoiceChannelId !== channel?.id) return;
      try {
        await ensureLocalMicStream();
        if (cancelled) return;
        voiceJoinChannelRef.current?.(channel.id);
      } catch (err) {
        if (!isStaleMicInitError(err)) {
          console.error('[Voice] ensureJoinedStream failed:', err);
        }
      }
    };
    ensureJoinedStream();
    return () => { cancelled = true; };
  }, [activeVoiceChannelId, channel?.id, joined, ensureLocalMicStream]);

  const handleJoinAnyway = useCallback(async () => {
    const result = await switchVoiceChannel(channel.id, { confirmedTargetRecording: true, confirmedStopRecording: true });
    if (result?.ok) {
      try {
        const { sendStream } = await ensureLocalMicStream();
        if (muted || voiceSettings.deafen) {
          applyMuteRef.current?.(true);
        }
      } catch (err) {
        if (!isStaleMicInitError(err)) {
          console.error('[Voice] handleJoinAnyway mic failed:', err);
        }
      }
      voiceJoinChannel(channel.id);
    }
    setConsentOpen(false);
  }, [channel?.id, ensureLocalMicStream, voiceSettings, voiceJoinChannel, switchVoiceChannel, muted]);

  // ─── Leave Voice ────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    // Leave WebRTC first (closes peer connections + signaling)
    await voiceLeaveChannel();
    cleanupLocalMicStream();
    await leaveVoiceChannel(channel.id);
    setMuted(false);
    setPttActive(false);
  }, [channel?.id, cleanupLocalMicStream, leaveVoiceChannel, voiceLeaveChannel]);

  // ─── Voice Settings handlers ────────────────────────────
  // If pushToTalk is turned off, deactivate PTT
  useEffect(() => {
    if (!voiceSettings.pushToTalk) {
      setPttActive(false);
    }
  }, [voiceSettings.pushToTalk]);

  // ─── Replace mic when device settings change ───────────────
  // Intentionally does NOT depend on muted/deafen/applyMute — mute is a track
  // operation, not a stream recreation.
  useEffect(() => {
    // Early bails: not joined, or already replacing
    if (!joined || activeVoiceChannelId !== channel?.id) return;
    if (replaceMicGuardRef.current) return;
    replaceMicGuardRef.current = true;

    // Detect actual device change vs initial mount
    const currentHash = [
      voiceSettings.selectedMicId,
      voiceSettings.inputDeviceId,
      voiceSettings.noiseSuppressionMode,
      voiceSettings.echoCancellation,
      voiceSettings.noiseSuppression,
      voiceSettings.autoGainControl,
      voiceSettings.micGain,
      voiceSettings.micBoost,
      voiceSettings.noiseGateThreshold,
      voiceSettings.noiseGateReduction,
    ].join('|');
    if (lastDeviceSettingsHashRef.current === currentHash && rawMicStreamRef.current) {
      replaceMicGuardRef.current = false;
      return;
    }
    lastDeviceSettingsHashRef.current = currentHash;

    let cancelled = false;
    const replaceJoinedMic = async () => {
      cleanupLocalMicStream();
      try {
        await ensureLocalMicStream();
        if (cancelled) return;
        applyMuteRef.current?.(muted || voiceSettings.deafen);
        voiceJoinChannelRef.current?.(channel.id, { force: true });
      } catch (err) {
        if (!isStaleMicInitError(err)) {
          console.error('[Voice] replaceJoinedMic failed:', err);
        }
      }
    };
    replaceJoinedMic();
    return () => { cancelled = true; replaceMicGuardRef.current = false; };
  }, [
    voiceSettings.selectedMicId,
    voiceSettings.inputDeviceId,
    voiceSettings.echoCancellation,
    voiceSettings.noiseSuppression,
    voiceSettings.autoGainControl,
    voiceSettings.noiseSuppressionMode,
    voiceSettings.micGain,
    voiceSettings.micBoost,
    voiceSettings.noiseGateThreshold,
    voiceSettings.noiseGateReduction,
    joined,
    channel?.id,
    activeVoiceChannelId,
  ]);

  // ─── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      cleanupLocalMicStream();
    };
  }, [cleanupLocalMicStream]);

  // ─── Recording metrics interval ─────────────────────────
  useEffect(() => {
    if (!channel?.id || !activeRecording) {
      setRecordingMetrics({ durationSeconds: 0, estimatedSizeBytes: 0 });
      return undefined;
    }
    const updateMetrics = () => {
      setRecordingMetrics(getActiveVoiceRecordingMetrics(channel.id));
    };
    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [channel?.id, activeRecording, getActiveVoiceRecordingMetrics]);

  // ─── Recording handler ──────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    setRecordingError('');
    setIsStartingRecording(true);
    try {
      const stream = sendStreamRef.current || liveMicStreamRef.current || webrtcStream || micStreamRef.current || micStream;
      const result = await startVoiceRecording(channel.id, stream, {
        recordingMode: remoteStreams.size > 0 ? 'MIXED_ROOM' : 'LOCAL_ONLY',
        remoteStreams,
        settings: voiceSettings,
      });
      if (!result?.ok) {
        setRecordingError(result?.message || result?.reason || 'Unable to start recording. Please check microphone permission.');
      }
    } finally {
      setIsStartingRecording(false);
    }
  }, [channel?.id, micStream, remoteStreams, startVoiceRecording, voiceSettings, webrtcStream]);

  const handleStartRawMicRecording = useCallback(async () => {
    setRecordingError('');
    setIsStartingRawRecording(true);
    try {
      const stream = micStreamRef.current || micStream || webrtcStream;
      const result = await startVoiceRecording(channel.id, stream, {
        recordingMode: 'RAW_LOCAL_MIC_TEST',
        recordingTestMode: 'RAW_LOCAL_MIC',
        remoteStreams: new Map(),
        settings: {
          ...voiceSettings,
          recordingTestMode: 'RAW_LOCAL_MIC',
          recordingQuality: 'high',
        },
      });
      if (!result?.ok) {
        setRecordingError(result?.message || result?.reason || 'Unable to start raw mic recording test.');
      }
    } finally {
      setIsStartingRawRecording(false);
    }
  }, [channel?.id, micStream, startVoiceRecording, voiceSettings, webrtcStream]);

  const handleStopRecording = useCallback(() => {
    stopVoiceRecording(channel.id);
  }, [channel?.id, stopVoiceRecording]);

  const refreshProcessingJob = useCallback(async (jobId) => {
    const job = await getAudioProcessingJob(jobId);
    if (job) {
      setProcessingJobs((prev) => ({ ...prev, [job.sourceRecordId]: job }));
    }
    return job;
  }, []);

  const handleConvertToMp3 = useCallback(async (record) => {
    const existing = processingJobs[record.id];
    if (existing?.status === AUDIO_PROCESSING_STATUS.COMPLETED) return;
    if (!window.confirm('Converting this recording to MP3 may use processing resources. Continue?')) return;
    const job = await createAudioProcessingJob(record, AUDIO_TARGET_FORMAT.MP3);
    setProcessingJobs((prev) => ({ ...prev, [record.id]: job }));
  }, [processingJobs]);

  const handleRetryConversion = useCallback(async (jobId) => {
    const job = await retryAudioProcessingJob(jobId);
    if (job) setProcessingJobs((prev) => ({ ...prev, [job.sourceRecordId]: job }));
  }, []);

  const handleCancelConversion = useCallback(async (jobId) => {
    const job = await cancelAudioProcessingJob(jobId);
    if (job) setProcessingJobs((prev) => ({ ...prev, [job.sourceRecordId]: job }));
  }, []);

  useEffect(() => {
    const runningJobs = Object.values(processingJobs).filter((job) =>
      [
        AUDIO_PROCESSING_STATUS.QUEUED,
        AUDIO_PROCESSING_STATUS.PROCESSING,
        AUDIO_PROCESSING_STATUS.CONVERTING,
        AUDIO_PROCESSING_STATUS.UPLOADING,
      ].includes(job.status)
    );
    if (!runningJobs.length) return undefined;
    const interval = setInterval(() => {
      runningJobs.forEach((job) => refreshProcessingJob(job.id));
    }, 500);
    return () => clearInterval(interval);
  }, [processingJobs, refreshProcessingJob]);

  // ─── Handle settings save ────────────────────────────────
  const handleSettingsSave = (updates) => {
    updateVoiceChannelPermissions(channel.id, updates);
    setSettingsOpen(false);
  };

  // ─── Display helpers ────────────────────────────────────
  const scopeLabel = channel?.scope === 'TEAM' ? 'Team Voice' : channel?.scope === 'CUSTOM' ? 'Custom Voice' : 'Workspace Voice';
  const allowedTeamNames = (channel?.allowedTeamIds || [])
    .map((teamId) => workspaceTeams.find((team) => team.id === teamId)?.name)
    .filter(Boolean);
  const estimatedSize = recordingMetrics.estimatedSizeBytes || 0;
  const mediaRecorderSupported = typeof window === 'undefined' ? true : Boolean(window.MediaRecorder);
  const recordingDisabled = !joined || !canRecord || isStartingRecording || !mediaRecorderSupported;
  const networkQuality = getNetworkQuality(socketLatencyMs, voiceConnected);

  const memberMap = useMemo(() => {
    const map = {};
    workspaceMembers.forEach((member) => {
      map[member.userId] = member;
    });
    return map;
  }, [workspaceMembers]);

  // ─── Render ──────────────────────────────────────────────

  if (!channel) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-8 text-center">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-8 py-10">
          <FiHeadphones className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-700">Select a voice channel</p>
          <p className="mt-1 text-xs text-slate-400">Voice presence and recording controls will appear here.</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-8 text-center">
        <div className="max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-8 py-10">
          <FiLock className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-700">No access to {channel.name}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            You do not have access to this voice channel. Ask the workspace Owner to add your team or user.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* ─── Header ──────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <FiHeadphones className="h-4 w-4 text-blue-600" />
            {channel.name}
            {channel.isLocked ? <FiLock className="h-3.5 w-3.5 text-slate-400" /> : null}
            {activeRecording ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">Recording</span> : null}
          </h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
            {scopeLabel}
            {allowedTeamNames.length ? ` · ${allowedTeamNames.join(', ')}` : ''}
            {channel.allowRecording ? ' · Recording enabled' : ' · Recording disabled'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NetworkStatusBadge
            latencyMs={socketLatencyMs}
            connected={voiceConnected}
            compact={false}
            showText
            label="Voice server ping"
          />
          {!joined || voicePeerStatus === 'idle' ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
              Not joined
            </span>
          ) : signalingStatus === 'reconnecting' ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
              Reconnecting...
            </span>
          ) : voicePeerStatus === 'waiting' ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-600">
              Connected · Waiting for others
            </span>
          ) : voicePeerStatus === 'connecting' ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
              Connecting to peers...
            </span>
          ) : voicePeerStatus === 'poor' || voiceConnectionState === 'poor' ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
              Poor connection
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
              Connected
            </span>
          )}
          {/* Voice Settings gear — available to all users */}
          <button
            type="button"
            onClick={() => setShowVoiceSettings(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Voice quality settings"
          >
            <FiSettings className="h-4 w-4" />
          </button>
          {canManagePermissions ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Voice channel permissions"
            >
              <FiLock className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      {/* ─── Body ─────────────────────────────────────────── */}
      <div className="discord-scroll flex-1 overflow-y-auto p-5">
        {/* Recording banner */}
        {activeRecording ? (
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-rose-700">
                  Recording started by {getDisplayName(recorder)}
                </p>
                <p className="mt-1 text-xs font-semibold text-rose-500">
                  {formatDuration(recordingMetrics.durationSeconds)} · Estimated {formatBytes(estimatedSize)}
                </p>
              </div>
              {estimatedSize > warningVoiceRecordingSizeBytes ? (
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-rose-600">
                  Large recording warning
                </span>
              ) : null}
            </div>
            {estimatedSize > warningVoiceRecordingSizeBytes ? (
              <p className="mt-3 text-xs leading-5 text-rose-600">
                This recording is getting large. AI processing may take longer and cost more.
              </p>
            ) : null}
          </div>
        ) : null}

        {permissionMessage ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
            {permissionMessage}
          </div>
        ) : null}
        {micTrackWarning ? (
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            {micTrackWarning}
          </div>
        ) : null}

        {/* ─── Voice Connection Status Banner ──────────────── */}
        {joined && (signalingStatus === 'reconnecting' || voicePeerStatus === 'poor') ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
            <FiWifiOff className="h-4 w-4 flex-shrink-0" />
            <span>
              {signalingStatus === 'reconnecting'
                ? 'Voice server connection lost. Reconnecting...'
                : 'Voice connection is unstable. Latency: ' + socketLatencyMs + 'ms'}
            </span>
          </div>
        ) : null}

        {joined ? <RemoteAudioRenderer remoteStreams={remoteStreams} settings={voiceSettings} /> : null}
        {audioWarning ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
            {audioWarning}
          </div>
        ) : null}

        {/* ─── Main grid: Participants + Controls ────────── */}
        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* ─── Participants ────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <FiUsers className="h-4 w-4" /> Participants
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">{participants.length}</span>
            </div>
            {participants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                <FiHeadphones className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-sm font-black text-slate-600">No one is in voice</p>
                <p className="mt-1 text-xs text-slate-400">Join to start presence for this channel.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => {
                  const member = memberMap[participant.userId] || { userId: participant.userId, name: participant.name };
                  const isRecorder = participant.userId === activeRecording?.startedBy || participant.isRecording;
                  const isLocal = participant.userId === currentUser?.id;

                  // Merge WebRTC remote state with local state
                  const remotePeerState = !isLocal ? remoteParticipants.get(participant.userId) : null;
                  const effectiveMuted = isLocal ? muted : (remotePeerState?.isMuted ?? participant.isMuted);
                  const effectiveSpeaking = isLocal
                    ? (!muted && isSpeaking && localAudioLevel > 0)
                    : (remotePeerState?.isSpeaking ?? participant.isSpeaking);
                  const networkLatency = remotePeerState?.pingMs ?? null;
                  const remoteStreamAvailable = remotePeerState?.hasAudio ?? false;

                  // Merge audio level from remote peer state (or local)
                  const mergedAudioLevel = isLocal
                    ? localAudioLevel
                    : (remotePeerState?.audioLevel ?? participant.audioLevel ?? 0);

                  return (
                    <VoiceParticipant
                      key={participant.userId}
                      participant={{ ...participant, isMuted: effectiveMuted, isSpeaking: effectiveSpeaking, audioLevel: mergedAudioLevel }}
                      member={member}
                      isLocal={isLocal}
                      isRecorder={isRecorder}
                      localMicEnabled={isMicEnabled}
                      localAudioLevel={localAudioLevel}
                      networkLatency={networkLatency}
                      remoteStreamAvailable={remoteStreamAvailable}
                      volume={voiceSettings.perUserVolumes?.[participant.userId] ?? 1}
                      onVolumeChange={!isLocal ? (volume) => setPerUserVolume(participant.userId, volume) : undefined}
                      voiceConnectionState={isLocal ? voiceConnectionState : undefined}
                      micStatus={isLocal ? micStatus : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Controls ────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Controls</h3>
            <div className="mt-4 grid gap-2">
              {/* Join / Leave */}
              {joined ? (
                <button
                  type="button"
                  onClick={handleLeave}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Leave Voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleJoin}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                >
                  Join Voice
                </button>
              )}

              {/* Mute / Unmute (only when joined) */}
              <button
                type="button"
                disabled={!joined}
                onClick={toggleMute}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {muted ? (
                  <span className="flex items-center justify-center gap-2"><FiMicOff className="h-4 w-4" /> Unmute Mic</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><FiMic className="h-4 w-4" /> Mute Mic</span>
                )}
              </button>

              <button
                type="button"
                disabled={!joined}
                onClick={toggleDeafen}
                className={`rounded-xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  voiceSettings.deafen
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <FiHeadphones className="h-4 w-4" />
                  {voiceSettings.deafen ? 'Undeafen' : 'Deafen'}
                </span>
              </button>
              {voiceSettings.deafen ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Deafen is on. Remote audio is muted and your mic is muted locally.
                </p>
              ) : null}

              {/* Push-to-talk indicator */}
              {joined && voiceSettings.pushToTalk && (
                <div className={`rounded-xl px-4 py-2 text-center text-xs font-black transition ${
                  pttActive
                    ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300'
                    : 'bg-slate-50 text-slate-400'
                }`}>
                  {pttActive ? '🔊 Speaking (PTT)' : '⌨️ Hold Space to talk'}
                </div>
              )}

              {/* ── Real-time mic connection status ──────────── */}
              {joined && !voiceSettings.pushToTalk ? (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black transition">
                  {/* Dot */}
                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                    voiceConnectionState === 'connected' && !muted && !voiceSettings.deafen
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-400/50'
                      : voiceConnectionState === 'requesting-mic' || voiceConnectionState === 'connecting'
                        ? 'bg-amber-400'
                        : voiceConnectionState === 'reconnecting' || voiceConnectionState === 'poor'
                          ? 'bg-amber-500'
                          : 'bg-slate-300'
                  } ${voiceConnectionState === 'connected' && !muted && !voiceSettings.deafen ? 'animate-pulse' : ''}`} />
                  {/* Label */}
                  <span className={
                    voiceConnectionState === 'connected' && !muted && !voiceSettings.deafen
                      ? 'text-emerald-700'
                      : muted || voiceSettings.deafen
                        ? 'text-slate-500'
                        : 'text-amber-700'
                  }>
                    {voiceConnectionState === 'connected' && !muted && !voiceSettings.deafen
                      ? 'Mic live — server connected'
                      : voiceConnectionState === 'requesting-mic'
                        ? 'Requesting microphone…'
                        : voiceConnectionState === 'connecting'
                          ? 'Connecting to voice server…'
                          : voiceConnectionState === 'reconnecting'
                            ? 'Reconnecting to voice server…'
                            : voiceConnectionState === 'poor'
                              ? 'Voice connection unstable'
                              : muted || voiceSettings.deafen
                                ? 'Mic muted locally'
                                : 'Not connected'}
                  </span>
                  {/* Latency */}
                  {voiceConnectionState === 'connected' && socketLatencyMs != null ? (
                    <span className="ml-auto text-[10px] text-slate-400">{socketLatencyMs}ms</span>
                  ) : null}
                </div>
              ) : null}

              {/* Start / Stop Recording */}
              {activeRecording ? (
                <button
                  type="button"
                  disabled={!joined || (activeRecording.startedBy !== currentUser?.id && !canManagePermissions)}
                  onClick={handleStopRecording}
                  className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stop Recording
                </button>
              ) : (
                <div className="grid gap-2">
                  <button
                    type="button"
                    disabled={recordingDisabled || isStartingRawRecording}
                    onClick={() => setPendingRecordingAction('standard')}
                    className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isStartingRecording ? 'Starting...' : 'Start Recording'}
                  </button>
                  <button
                    type="button"
                    disabled={recordingDisabled || isStartingRecording}
                    onClick={() => setPendingRecordingAction('raw')}
                    className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isStartingRawRecording ? 'Starting raw test...' : 'Raw Mic Test Recording'}
                  </button>
                </div>
              )}
              {recordingError ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                  {recordingError}
                </p>
              ) : null}
            </div>

            {/* Recording metrics */}
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
              <div
                className="mb-2 flex items-center justify-between"
                title={voiceConnected && socketLatencyMs ? `Voice ping: ${socketLatencyMs}ms - ${networkQuality.label}` : 'Measuring voice ping...'}
              >
                <span>Network</span>
                <span className={
                  networkQuality.key === 'good'
                    ? 'text-emerald-600'
                    : networkQuality.key === 'medium'
                      ? 'text-amber-600'
                      : networkQuality.key === 'poor'
                        ? 'text-rose-600'
                        : 'text-slate-400'
                }>
                  {networkQuality.label}{socketLatencyMs ? ` · ${socketLatencyMs}ms` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Timer</span>
                <span>{formatDuration(recordingMetrics.durationSeconds || 0)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Estimated size</span>
                <span>{formatBytes(estimatedSize)}</span>
              </div>
              {activeRecording ? (
                <div className={`mt-2 rounded-lg px-3 py-2 ${recordingMetrics.peakLevel >= 0.98 || recordingMetrics.clippingFrames > 2 ? 'bg-rose-50 text-rose-600' : 'bg-white text-slate-500'}`}>
                  <div className="flex items-center justify-between">
                    <span>Rec peak / RMS</span>
                    <span>{(recordingMetrics.peakLevel ?? 0).toFixed(3)} / {(recordingMetrics.rmsLevel ?? 0).toFixed(3)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Raw peak / RMS</span>
                    <span>{(recordingMetrics.rawPeak ?? 0).toFixed(3)} / {(recordingMetrics.rawRms ?? 0).toFixed(3)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Chunks</span>
                    <span>{recordingMetrics.chunkCount ?? 0} · {formatBytes(recordingMetrics.latestChunkSize ?? 0)}</span>
                  </div>
                  {recordingMetrics.compressorReduction > 8 ? (
                    <p className="mt-1 leading-5 text-amber-600">Compressor is working hard. Recording may sound unnatural.</p>
                  ) : null}
                  {recordingMetrics.peakLevel >= 0.98 || recordingMetrics.clippingFrames > 2 ? (
                    <p className="mt-1 leading-5">Recording is close to clipping. Lower recording gain or move farther from the mic.</p>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-3 text-[11px] leading-5 text-slate-400">Max AI upload size: 400MB</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">
                Browser recording uses WebM/Opus. Convert to MP3 later by backend if needed. Use headphones to reduce echo/noise in recordings.
              </p>
              {activeRecording?.recordingMode === 'MIXED_ROOM' ? (
                <p className="mt-2 text-[11px] leading-5 text-amber-600">
                  Participants who join after recording starts may not be included until the mixer is restarted.
                </p>
              ) : null}
              {activeRecording?.recordingMode === 'RAW_LOCAL_MIC_TEST' ? (
                <p className="mt-2 text-[11px] leading-5 text-blue-600">
                  Raw mic test mode records only your cloned local microphone as WebM/Opus at 128 kbps.
                </p>
              ) : null}
            </div>

            {/* Mic status */}
            {joined && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] font-semibold text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Mic status</span>
                  <span className={muted ? 'text-rose-500' : 'text-emerald-600'}>
                    {muted ? 'Muted' : 'Active'}
                  </span>
                </div>
                {voiceSettings.pushToTalk && (
                  <div className="mt-1 flex items-center justify-between">
                    <span>Push to Talk</span>
                    <span className="text-blue-600">On</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ─── Recent Recordings ────────────────────────── */}
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Recent Recordings</h3>
            <span className="text-[11px] font-bold text-slate-400">{records.length} records</span>
          </div>
          {records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <FiClock className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-black text-slate-600">No recordings yet</p>
              <p className="mt-1 text-xs text-slate-400">Completed recordings will appear here with playback, download, and AI actions.</p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {records.map((record) => {
                const tooLargeForAI = record.sizeBytes > maxVoiceRecordingSizeBytes;
                const nearAiLimit = record.sizeBytes > warningVoiceRecordingSizeBytes;
                const job = processingJobs[record.id];
                const originalIsMp3 = record.format?.includes('mpeg') || record.fileName?.toLowerCase().endsWith('.mp3');
                const mp3Ready = originalIsMp3 || job?.status === AUDIO_PROCESSING_STATUS.COMPLETED;
                const extensionMismatch = !extensionMatchesMime(record.fileName, record.format || record.mimeType);
                const playbackGain = playbackGainByRecord[record.id] ?? 0.85;
                const jobRunning = job && [
                  AUDIO_PROCESSING_STATUS.QUEUED,
                  AUDIO_PROCESSING_STATUS.PROCESSING,
                  AUDIO_PROCESSING_STATUS.CONVERTING,
                  AUDIO_PROCESSING_STATUS.UPLOADING,
                ].includes(job.status);
                const jobFailed = job?.status === AUDIO_PROCESSING_STATUS.FAILED;
                return (
                  <article key={record.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-black text-slate-900">{record.title}</h4>
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          {formatDuration(record.durationSeconds)} - {formatBytes(record.sizeBytes)} - {formatAudioFormat(record.format)} {record.bitrate ? `- ${Math.round(record.bitrate / 1000)} kbps` : ''}
                        </p>
                        {record.peakLevel != null ? (
                          <p className={`mt-1 text-[11px] font-bold ${record.peakLevel >= 0.98 || record.clippingFrames > 2 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            Rec peak {record.peakLevel.toFixed(3)} - raw peak {(record.rawPeak ?? 0).toFixed(3)} - chunks {record.chunkCount ?? 0} - clipping frames {record.clippingFrames ?? 0}
                          </p>
                        ) : null}
                      </div>
                      {record.autoStopped ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">Auto stopped</span> : null}
                    </div>
                    {record.objectUrl ? (
                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <audio
                          className="w-full"
                          controls
                          src={record.objectUrl}
                          type={record.format || record.mimeType}
                          ref={(node) => {
                            if (node) node.volume = Math.max(0, Math.min(1, playbackGain));
                          }}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                          <span>Preview volume</span>
                          <input
                            type="range"
                            min="0"
                            max="150"
                            value={Math.round(playbackGain * 100)}
                            onChange={(event) => {
                              const value = Number(event.target.value) / 100;
                              setPlaybackGainByRecord((prev) => ({ ...prev, [record.id]: value }));
                            }}
                            className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
                          />
                          <span>{Math.round(playbackGain * 100)}%</span>
                          <button
                            type="button"
                            onClick={() => setPlaybackGainByRecord((prev) => ({ ...prev, [record.id]: 1.2 }))}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-black text-slate-600 hover:bg-slate-100"
                          >
                            Normalize preview
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">Audio object is not available.</div>
                    )}
                    {extensionMismatch ? <p className="mt-2 text-xs font-semibold text-rose-600">File extension does not match the recorded MIME type.</p> : null}
                    {tooLargeForAI ? <p className="mt-2 text-xs font-semibold text-rose-600">Recording exceeds 400MB and cannot be sent to AI.</p> : null}
                    {nearAiLimit && !tooLargeForAI ? <p className="mt-2 text-xs font-semibold text-amber-600">Large recording warning: AI processing may be slower near 400MB.</p> : null}
                    {record.format?.includes('webm') ? (
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">Browser recording uses WebM/Opus. Convert to MP3 later by backend if needed.</p>
                    ) : null}
                    {job ? (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-[11px] font-black text-slate-500">
                          <span>MP3 conversion: {job.status}</span>
                          <span>{job.progress || 0}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${job.progress || 0}%` }} />
                        </div>
                        {jobFailed ? <p className="mt-2 text-xs font-semibold text-rose-600">{job.errorMessage || 'MP3 conversion failed. Please try again.'}</p> : null}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={record.objectUrl || '#'}
                        download={record.fileName}
                        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 ${record.objectUrl ? '' : 'pointer-events-none opacity-50'}`}
                      >
                        <FiDownload className="h-3.5 w-3.5" /> Download Original
                      </a>
                      {mp3Ready ? (
                        <a
                          href={originalIsMp3 ? record.objectUrl || '#' : job.outputObjectUrl || record.objectUrl || '#'}
                          download={originalIsMp3 ? record.fileName : job.outputFileName || `${record.title}.mp3`}
                          className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 ${record.objectUrl || job?.outputObjectUrl ? '' : 'pointer-events-none opacity-50'}`}
                        >
                          <FiDownload className="h-3.5 w-3.5" /> {originalIsMp3 ? 'Download MP3' : 'Download MP3'}
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={jobRunning}
                          onClick={() => handleConvertToMp3(record)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FiRadio className="h-3.5 w-3.5" /> Convert to MP3
                        </button>
                      )}
                      {jobRunning ? (
                        <button type="button" onClick={() => handleCancelConversion(job.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-50">Cancel</button>
                      ) : null}
                      {jobFailed ? (
                        <button type="button" onClick={() => handleRetryConversion(job.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100">Retry</button>
                      ) : null}
                      <button
                        type="button"
                        disabled={tooLargeForAI || record.aiStatus === 'SENT_TO_AI'}
                        onClick={() => sendVoiceRecordToAI(record.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiZap className="h-3.5 w-3.5" /> {record.aiStatus === 'SENT_TO_AI' ? 'Sent to AI' : mp3Ready ? 'Send MP3 to AI' : 'Send Original to AI'}
                      </button>
                      {canManagePermissions ? (
                        <button type="button" onClick={() => setPendingDeleteRecord(record)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50">
                          <FiTrash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ─── Consent Modal ───────────────────────────────── */}
      {consentOpen ? (
        <ConfirmModal
          title="This voice channel is currently being recorded."
          message="By joining, your voice may be included in the recording. Do you still want to join?"
          onCancel={() => setConsentOpen(false)}
          onConfirm={handleJoinAnyway}
        />
      ) : null}

      {/* ─── Voice Channel Permission Modal ──────────────── */}
      {pendingDeleteRecord ? (
        <ConfirmModal
          title="Delete this recording?"
          message={`This will remove "${pendingDeleteRecord.title || pendingDeleteRecord.fileName || 'this recording'}" from the recent recordings list. Download it first if you need a copy.`}
          cancelLabel="Keep Recording"
          confirmLabel="Delete Recording"
          confirmTone="danger"
          onCancel={() => setPendingDeleteRecord(null)}
          onConfirm={() => {
            deleteVoiceRecord(pendingDeleteRecord.id);
            setPendingDeleteRecord(null);
          }}
        />
      ) : null}

      {pendingRecordingAction ? (
        <ConfirmModal
          title={pendingRecordingAction === 'raw' ? 'Start raw mic test recording?' : 'Start voice recording?'}
          message={
            pendingRecordingAction === 'raw'
              ? 'This will record your local microphone test audio for quality checks. Continue?'
              : 'This will record this voice channel. Participants in the channel may be included in the recording. Continue?'
          }
          cancelLabel="Cancel"
          confirmLabel={pendingRecordingAction === 'raw' ? 'Start Raw Test' : 'Start Recording'}
          confirmTone={pendingRecordingAction === 'raw' ? 'primary' : 'danger'}
          onCancel={() => setPendingRecordingAction(null)}
          onConfirm={() => {
            const action = pendingRecordingAction;
            setPendingRecordingAction(null);
            if (action === 'raw') {
              handleStartRawMicRecording();
              return;
            }
            handleStartRecording();
          }}
        />
      ) : null}

      {settingsOpen ? (
        <VoicePermissionModal
          channel={channel}
          teams={workspaceTeams}
          members={workspaceMembers}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSettingsSave}
        />
      ) : null}

      {/* ─── Voice Quality Settings Modal ────────────────── */}
      {showVoiceSettings ? (
        <VoiceQualitySettingsPanel
          settings={voiceSettings}
          onChange={updateSetting}
          onClose={() => setShowVoiceSettings(false)}
        />
      ) : null}

      {/* ─── Debug Voice Panel (dev only) ─────────────────── */}
      <VoiceDebugPanel
        voiceConnection={{
          signalingStatus,
          voicePeerStatus,
          voiceConnectionState,
          micStatus,
          socketLatencyMs,
          hasRemotePeers,
          remoteStreams,
          peerStates,
          peerCount,
          turnConfigured,
          stunConfigured,
          lastWebRTCError,
          lastSocketEvent,
          channelId: channel?.id,
          socketConnected: voiceConnected,
        }}
        voiceState={{ muted, deafen: voiceSettings.deafen, joined, pttActive }}
        micStream={micStreamRef.current}
        vadStream={vadStreamRef.current}
        processedMicStream={processedMicStream}
        audioLevel={localAudioLevel}
        rawRms={rawRms}
        vadPeak={vadPeak}
        vadClippingRisk={vadClippingRisk}
        audioProcessingStats={audioProcessingStats}
        isSpeaking={isSpeaking}
        vadSource={vadSourceRef.current}
        lastAudioLevelUpdateAt={localAudioLevelUpdateRef.current}
        recordingState={activeRecording ? { ...activeRecording, metrics: recordingMetrics } : null}
        settings={voiceSettings}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Voice Quality Settings Modal
   ══════════════════════════════════════════════════════════════ */
