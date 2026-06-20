'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useVoiceConnection } from '@/context/VoiceConnectionContext';
import usePersistentVoiceSettings from '@/hooks/usePersistentVoiceSettings';
import useVoiceMic from '@/hooks/voice/useVoiceMic';
import useVoicePermissions from '@/hooks/voice/useVoicePermissions';
import {
  buildAudioConstraints,
  extensionMatchesMime,
} from '@/lib/voiceAudioQuality';
import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';
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
import VoiceControls from './voice-channel/VoiceControls';
import VoiceRecordingsPanel from './voice-channel/VoiceRecordingsPanel';
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

/* ─── Debug ────────────────────────────────────────────────── */
const VOICE_DEBUG = process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

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

  // ─── Voice settings ──────────────────────────────────────
  const { settings: voiceSettings, updateSetting, setPerUserVolume } = usePersistentVoiceSettings(currentUser?.id, channel?.workspaceId);
  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  // ─── Derived data ────────────────────────────────────────
  // voiceParticipants: { [channelId]: { [userId]: participant } }
  const channelParticipants = (voiceParticipants || {})[channel?.id];
  const participants = channelParticipants ? Object.values(channelParticipants) : [];
  const activeRecording = (activeVoiceRecordings || {})[channel?.id] || null;
  const records = (voiceRecords || []).filter((record) =>
    record.workspaceId === channel?.workspaceId || !channel?.workspaceId
      ? record.channelId === channel?.id && record.status !== 'DELETED'
      : false
  );
  const canAccess = channel ? canAccessVoice(channel) : false;
  const canRecord = channel ? canRecordVoice(channel) : false;
  const joined = participants.some((participant) => participant.userId === currentUser?.id);
  const canManagePermissions = ['OWNER', 'VICE_ADMIN', 'MANAGER'].includes(workspaceRole);
  const recorder = activeRecording
    ? workspaceMembers.find((member) => member.userId === activeRecording.startedBy)
    : null;

  // Local participant for quick lookup
  const localParticipant = participants.find((p) => p.userId === currentUser?.id);

  // ─── useVoiceMic — mic stream, VAD, mute/deafen/PTT ───────
  const micHook = useVoiceMic({
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
    showToast: null,
  });

  const {
    // State
    micStream, vadStream, processedMicStream,
    audioProcessingStats, micTrackWarning,
    muted, pttActive, localAudioLevel,
    isMicEnabled, isSpeaking, audioLevel,
    rawRms, vadPeak, vadClippingRisk, vadHasInput,
    // Refs
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
    // Debug
    localAudioLevelUpdateRef,
    vadSourceRef, logMicDebug, isStaleMicInitError,
  } = micHook;

  // ─── useVoicePermissions — permission modals, debug toggle ─
  const permHook = useVoicePermissions({
    joined,
    muted,
    isMicEnabled,
    setMuted,
    toggleMute,
  });

  const {
    showSettings: debugShowSettings,
    showDebug,
    toggleDebug,
    handlePermissionDenied,
    dismissPermissionMessage,
    handleJoinAnyway: permHandleJoinAnyway,
    resetPermissionState,
    permissionModalInfo,
  } = permHook;

  // ─── Join coordination guard ──────────────────────────────
  const joiningRef = useRef(false);

  // ─── UI State (kept inline — tied to workspace context) ──
  const [consentOpen, setConsentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isStartingRawRecording, setIsStartingRawRecording] = useState(false);
  const [processingJobs, setProcessingJobs] = useState({});
  const [recordingMetrics, setRecordingMetrics] = useState({ durationSeconds: 0, estimatedSizeBytes: 0 });
  const [playbackGainByRecord, setPlaybackGainByRecord] = useState({});
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState(null);
  const [pendingRecordingAction, setPendingRecordingAction] = useState(null);

  // ─── Sync remote participant metadata to global context ──
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

  // ─── Clean up stale participants (left the channel) ────
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
      try {
        const { sendStream } = await ensureLocalMicStream();
        if (muted || voiceSettings.deafen) {
          applyMuteRef.current?.(true);
        }
        if (VOICE_DEBUG) {
          logMicDebug();
        }
      } catch (err) {
        if (!isStaleMicInitError(err)) {
          console.error('[Voice] Failed to init mic:', err);
        }
      }
      voiceJoinChannel(channel.id);
    }
    joiningRef.current = false;
  }, [channel?.id, ensureLocalMicStream, voiceSettings, voiceJoinChannel, switchVoiceChannel, muted, logMicDebug, isStaleMicInitError, applyMuteRef]);

  // ─── Safety net: ensure mic stream when user is already joined ──
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
  }, [activeVoiceChannelId, channel?.id, joined, ensureLocalMicStream, isStaleMicInitError, rawMicStreamRef]);

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
  }, [channel?.id, ensureLocalMicStream, voiceSettings, voiceJoinChannel, switchVoiceChannel, muted, isStaleMicInitError, applyMuteRef]);

  // ─── Leave Voice ────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    await voiceLeaveChannel();
    cleanupLocalMicStream();
    await leaveVoiceChannel(channel.id);
    setMuted(false);
    setPttActive(false);
  }, [channel?.id, cleanupLocalMicStream, leaveVoiceChannel, voiceLeaveChannel, setMuted, setPttActive]);

  // ─── Voice Settings handlers ────────────────────────────
  useEffect(() => {
    if (!voiceSettings.pushToTalk) {
      setPttActive(false);
    }
  }, [voiceSettings.pushToTalk, setPttActive]);

  // ─── Device settings hash — detect real mic-replacement events ──
  const lastDeviceSettingsHashRef = useRef('');
  const replaceMicGuardRef = useRef(false);

  // ─── Replace mic when device settings change ───────────
  // Intentionally does NOT depend on muted/deafen/applyMute — mute is a track
  // operation, not a stream recreation.
  useEffect(() => {
    if (!joined || activeVoiceChannelId !== channel?.id) return;
    if (replaceMicGuardRef.current) return;
    replaceMicGuardRef.current = true;

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
    cleanupLocalMicStream,
    ensureLocalMicStream,
    isStaleMicInitError,
    muted,
    voiceSettings.deafen,
  ]);

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

  // ─── Recording handlers ─────────────────────────────────
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
  }, [channel?.id, micStream, remoteStreams, startVoiceRecording, voiceSettings, webrtcStream, sendStreamRef, liveMicStreamRef, micStreamRef]);

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
  }, [channel?.id, micStream, startVoiceRecording, voiceSettings, webrtcStream, micStreamRef]);

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

  // ─── Processing job polling ─────────────────────────────
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

  // ─── Handle settings save ──────────────────────────────
  const handleSettingsSave = useCallback((updates) => {
    updateVoiceChannelPermissions(channel.id, updates);
    setSettingsOpen(false);
  }, [channel?.id, updateVoiceChannelPermissions]);

  // ─── Display helpers ───────────────────────────────────
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

  // ─── Recording panel shared helpers ────────────────────
  const handleDownload = useCallback((record) => {
    // If the record has _mp3Url (set by VoiceRecordingsPanel for MP3 downloads),
    // download that instead.
    const url = record._mp3Url || record.objectUrl;
    const name = record._mp3Name || record.fileName;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }, []);

  // ─── Render ──────────────────────────────────────────────

  if (!channel) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900 p-8 text-center">
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-8 py-10">
          <FiHeadphones className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-200">Select a voice channel</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Voice presence and recording controls will appear here.</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900 p-8 text-center">
        <div className="max-w-md rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-8 py-10">
          <FiLock className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-200">No access to {channel.name}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400 dark:text-slate-500">
            You do not have access to this voice channel. Ask the workspace Owner to add your team or user.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      {/* ─── Header ──────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
            <FiHeadphones className="h-4 w-4 text-blue-600" />
            {channel.name}
            {channel.isLocked ? <FiLock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> : null}
            {activeRecording ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">Recording</span> : null}
          </h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
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
            <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-black text-slate-500 dark:text-slate-400">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
            title="Voice quality settings"
          >
            <FiSettings className="h-4 w-4" />
          </button>
          {canManagePermissions ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
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
                <span className="rounded-full bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-black text-rose-600">
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

        {/* Voice Connection Status Banner */}
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
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <FiUsers className="h-4 w-4" /> Participants
              </h3>
              <span className="rounded-full bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:text-slate-400">{participants.length}</span>
            </div>
            {participants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-8 text-center">
                <FiHeadphones className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-sm font-black text-slate-600 dark:text-slate-300">No one is in voice</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Join to start presence for this channel.</p>
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

          {/* ─── Controls Panel (VoiceControls component) ── */}
          <VoiceControls
            joined={joined}
            onJoin={handleJoin}
            onLeave={handleLeave}
            muted={muted}
            onToggleMute={toggleMute}
            deafen={voiceSettings.deafen}
            onToggleDeafen={toggleDeafen}
            isMicEnabled={isMicEnabled}
            isSpeaking={isSpeaking}
            isPTTActive={pttActive}
            recordingState={activeRecording ? 'recording' : 'idle'}
            onToggleRecording={activeRecording ? handleStopRecording : undefined}
            voiceSettings={voiceSettings}
            showSettings={settingsOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            showDebug={showDebug}
            onToggleDebug={toggleDebug}
            canManagePermissions={canManagePermissions}
            channelName={channel?.name}
            participantCount={participants.length}
            audioLevel={audioLevel}
            isMicActive={!!micStream}
          />

          {/* Recording metrics section (replaces old inline controls panel recording section) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Recording</h3>
            <div className="mt-4 grid gap-2">
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
            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                        : 'text-slate-400 dark:text-slate-500'
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
                <div className={`mt-2 rounded-lg px-3 py-2 ${recordingMetrics.peakLevel >= 0.98 || recordingMetrics.clippingFrames > 2 ? 'bg-rose-50 text-rose-600' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
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
              <p className="mt-3 text-[11px] leading-5 text-slate-400 dark:text-slate-500">Max AI upload size: 400MB</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
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
          </div>
        </section>

        {/* ─── Recent Recordings ────────────────────────── */}
        <VoiceRecordingsPanel
          records={records}
          formatDuration={formatDuration}
          formatFileSize={formatBytes}
          formatAudioFormat={formatAudioFormat}
          processingJobs={processingJobs}
          playbackGainByRecord={playbackGainByRecord}
          setPlaybackGainByRecord={setPlaybackGainByRecord}
          maxVoiceRecordingSizeBytes={maxVoiceRecordingSizeBytes}
          warningVoiceRecordingSizeBytes={warningVoiceRecordingSizeBytes}
          AUDIO_PROCESSING_STATUS={AUDIO_PROCESSING_STATUS}
          extensionMatchesMime={extensionMatchesMime}
          onDownload={handleDownload}
          onConvertToMp3={handleConvertToMp3}
          onCancelConversion={handleCancelConversion}
          onRetryConversion={handleRetryConversion}
          onSendToAI={sendVoiceRecordToAI}
          onDelete={(record) => setPendingDeleteRecord(record)}
          canManagePermissions={canManagePermissions}
        />
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
      {showDebug ? (
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
      ) : null}
    </div>
  );
}
