'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  normalizeVoiceChannel,
} from '@/lib/voicePermissions';
import {
  buildAudioConstraints,
  buildMediaRecorderOptions,
  createProcessedLocalRecordingStream,
  createProcessedRecordingStream,
} from '@/lib/voiceAudioQuality';
import { createVoiceRecord as serviceCreateVoiceRecord } from '@/services/voiceRecordingService';
import { generateId } from '@/lib/workspaceData';

/**
 * useVoiceState — manages voice presence, recording, and channel permissions.
 *
 * Extracted from WorkspaceContext to keep the provider focused on composition.
 * All state/actions are returned for passthrough into the context value object.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @param {Array} params.voiceChannels
 * @param {string|null} params.workspaceRole
 * @param {string|null} params.activeWorkspaceId
 * @param {boolean} params.canManageAIReview
 * @param {Function} params.canAccessVoice
 * @param {Function} params.canRecordVoice
 * @param {Function} params.setWorkspaces
 * @param {Function} params.setWorkspaceMeetings
 * @param {Function} params.showToast
 * @param {Function} params.addActivity
 * @returns {{
 *   voiceParticipants: Object,
 *   activeVoiceChannelId: string|null,
 *   activeVoiceRecordings: Object,
 *   voiceRecords: Array,
 *   updateVoiceParticipantState: (channelId: string, userId: string, updates: Object) => void,
 *   syncVoiceParticipant: (channelId: string, participantData: Object) => void,
 *   removeVoiceParticipant: (channelId: string, userId: string) => void,
 *   setVoiceChannelParticipants: (channelId: string, participants: Array) => void,
 *   joinVoiceChannel: (channelId: string, options?: Object) => void,
 *   leaveVoiceChannel: (channelId: string) => void,
 *   switchVoiceChannel: (targetChannelId: string, options?: Object) => void,
 *   getCurrentUserVoiceChannel: () => string|null,
 *   isCurrentUserInVoice: (channelId: string) => boolean,
 *   removeUserFromAllVoiceChannels: (userId: string) => void,
 *   startVoiceRecording: (channelId: string, providedStream?: MediaStream, options?: Object) => Promise<Object|null>,
 *   stopVoiceRecording: (channelId: string, reason?: string) => void,
 *   getActiveVoiceRecordingMetrics: (channelId: string) => Object|null,
 *   updateVoiceChannelPermissions: (channelId: string, updates: Object) => void,
 *   addTeamToVoiceChannel: (channelId: string, teamId: string) => void,
 *   removeTeamFromVoiceChannel: (channelId: string, teamId: string) => void,
 *   addUserToVoiceChannel: (channelId: string, userId: string) => void,
 *   removeUserFromVoiceChannel: (channelId: string, userId: string) => void,
 *   toggleVoiceChannelLock: (channelId: string, isLocked: boolean) => void,
 *   toggleVoiceRecordingPermission: (channelId: string, allowRecording: boolean) => void,
 *   sendVoiceRecordToAI: (recordId: string) => Promise<Object|void>,
 *   deleteVoiceRecord: (recordId: string) => void,
 * }}
 */
export default function useVoiceState({
  currentUser,
  voiceChannels,
  workspaceRole,
  activeWorkspaceId,
  canManageAIReview,
  canAccessVoice,
  canRecordVoice,
  setWorkspaces,
  setWorkspaceMeetings,
  showToast,
  addActivity,
}) {
  // ─── Voice State ──────────────────────────────────────
  const [voiceParticipants, setVoiceParticipants] = useState({});
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);
  const [activeVoiceRecordings, setActiveVoiceRecordings] = useState({});
  const [voiceRecords, setVoiceRecords] = useState([]);
  const voiceRecordsRef = useRef([]);
  const mediaRecorderRefs = useRef({});
  const mediaStreamRefs = useRef({});
  const mediaChunkRefs = useRef({});
  const mediaCleanupRefs = useRef({});

  useEffect(() => {
    voiceRecordsRef.current = voiceRecords;
  }, [voiceRecords]);

  // ─── Voice Functions ──────────────────────────────────
  const joinVoiceChannel = useCallback((channelId, options = {}) => {
    const channel = voiceChannels.find((c) => c.id === channelId);
    if (!channel) {
      showToast('error', 'Voice channel not found.');
      return;
    }

    if (!canAccessVoice(channel)) {
      showToast('error', 'You do not have permission to join this voice channel.');
      return;
    }

    if (channel.speakPermission === 'TEAM' && !channel.allowedTeamIds?.length) {
      showToast('error', 'This voice channel is restricted to specific teams and no teams are assigned.');
      return;
    }

    const recordingConsent = channel.allowRecording !== false;
    setActiveVoiceChannelId(channelId);
    setVoiceParticipants((prev) => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] || {}),
        [currentUser?.id]: {
          userId: currentUser?.id,
          userName: currentUser?.name,
          avatar: currentUser?.avatar,
          role: workspaceRole,
          recordingConsent,
          joinedAt: Date.now(),
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
          audioLevel: 0,
          streamId: null,
        },
      },
    }));
  }, [voiceChannels, workspaceRole, currentUser, canAccessVoice, showToast]);

  const updateVoiceParticipantState = useCallback((channelId, userId, updates) => {
    setVoiceParticipants((prev) => {
      const channel = prev[channelId];
      if (!channel || !channel[userId]) return prev;
      const clean = { ...updates };
      delete clean.audioLevel;
      return {
        ...prev,
        [channelId]: {
          ...channel,
          [userId]: { ...channel[userId], ...clean },
        },
      };
    });
  }, []);

  const syncVoiceParticipant = useCallback((channelId, participantData) => {
    if (!participantData?.userId) return;
    setVoiceParticipants((prev) => {
      const channel = prev[channelId] || {};
      const existing = channel[participantData.userId];
      const clean = { ...participantData };
      delete clean.audioLevel;
      return {
        ...prev,
        [channelId]: {
          ...channel,
          [participantData.userId]: existing ? { ...existing, ...clean } : {
            userId: participantData.userId,
            userName: participantData.userName || 'Unknown',
            avatar: participantData.avatar || null,
            role: participantData.role || workspaceRole,
            recordingConsent: true,
            joinedAt: participantData.joinedAt || Date.now(),
            isMuted: participantData.isMuted || false,
            isDeafened: participantData.isDeafened || false,
            isSpeaking: participantData.isSpeaking || false,
            audioLevel: 0,
            streamId: participantData.streamId || null,
          },
        },
      };
    });
  }, [workspaceRole]);

  const removeVoiceParticipant = useCallback((channelId, userId) => {
    setVoiceParticipants((prev) => {
      const channel = prev[channelId];
      if (!channel) return prev;
      const { [userId]: _, ...rest } = channel;
      if (Object.keys(rest).length === 0) {
        const { [channelId]: _c, ...remaining } = prev;
        return remaining;
      }
      return { ...prev, [channelId]: rest };
    });
  }, []);

  const setVoiceChannelParticipants = useCallback((channelId, participants) => {
    setVoiceParticipants((prev) => ({
      ...prev,
      [channelId]: (participants || []).reduce((acc, p) => {
        const clean = { ...p };
        delete clean.audioLevel;
        acc[p.userId] = clean;
        return acc;
      }, {}),
    }));
  }, []);

  const finishVoiceRecording = useCallback(async (channelId, reason = 'manual') => {
    const recorder = mediaRecorderRefs.current[channelId];
    if (!recorder || recorder.state === 'inactive') return;

    // Stop recorder
    const stopPromise = new Promise((resolve) => {
      const handler = () => { resolve(); };
      if (recorder.state === 'inactive') { resolve(); return; }
      recorder.addEventListener('stop', handler, { once: true });
      recorder.stop();
      // Fallback if stop event doesn't fire
      setTimeout(resolve, 1000);
    });
    await stopPromise;

    const chunks = mediaChunkRefs.current[channelId] || [];
    const mimeType = recorder.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type: mimeType });
    const size = blob.size;
    const duration = (Date.now() - (activeVoiceRecordings[channelId]?.startedAt || Date.now())) / 1000;

    // Run audio context cleanup
    const cleanup = mediaCleanupRefs.current[channelId];
    if (cleanup) {
      try { cleanup(); } catch { /* ignore */ }
    }

    // Stop stream tracks
    const stream = mediaStreamRefs.current[channelId];
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    }

    let record = null;
    try {
      const objectUrl = URL.createObjectURL(blob);
      record = await serviceCreateVoiceRecord({
        channelId,
        workspaceId: activeWorkspaceId,
        userId: currentUser?.id,
        userName: currentUser?.name,
        blob,
        mimeType,
        size,
        duration,
        reason,
        objectUrl,
      });

      if (record) {
        setVoiceRecords((prev) => [...prev, record]);
        addActivity('voice_recording_finished', `Voice recording saved (${Math.round(duration)}s)`);
      } else {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      showToast('error', 'Failed to save voice recording.');
    }

    // Clear isRecording from all participants in this channel
    const channelParts = voiceParticipants[channelId];
    if (channelParts) {
      Object.keys(channelParts).forEach((uid) => {
        if (channelParts[uid]?.isRecording) {
          updateVoiceParticipantState(channelId, uid, { isRecording: false, recordingSince: null });
        }
      });
    }

    // Cleanup refs for this channel
    delete mediaRecorderRefs.current[channelId];
    delete mediaStreamRefs.current[channelId];
    delete mediaChunkRefs.current[channelId];
    delete mediaCleanupRefs.current[channelId];

    setActiveVoiceRecordings((prev) => {
      if (!prev[channelId]) return prev;
      const { [channelId]: _, ...rest } = prev;
      return rest;
    });

    return record;
  }, [activeWorkspaceId, currentUser, activeVoiceRecordings, voiceParticipants, updateVoiceParticipantState, addActivity, showToast]);

  const leaveVoiceChannel = useCallback((channelId) => {
    if (activeVoiceRecordings[channelId]) {
      finishVoiceRecording(channelId, 'leave');
    }

    setVoiceParticipants((prev) => {
      const { [channelId]: _ch, ...rest } = prev;
      return rest;
    });

    if (activeVoiceChannelId === channelId) {
      setActiveVoiceChannelId(null);
    }

    addActivity('voice_left', 'Left voice channel');
  }, [activeVoiceRecordings, activeVoiceChannelId, finishVoiceRecording, addActivity]);

  const getCurrentUserVoiceChannel = useCallback(() => {
    return activeVoiceChannelId;
  }, [activeVoiceChannelId]);

  const isCurrentUserInVoice = useCallback((channelId) => {
    const channel = voiceParticipants[channelId];
    return !!channel?.[currentUser?.id];
  }, [voiceParticipants, currentUser]);

  const removeUserFromAllVoiceChannels = useCallback((userId) => {
    setVoiceParticipants((prev) => {
      const next = {};
      for (const chId of Object.keys(prev)) {
        const { [userId]: _, ...rest } = prev[chId];
        if (Object.keys(rest).length > 0) {
          next[chId] = rest;
        }
      }
      return next;
    });
  }, []);

  const switchVoiceChannel = useCallback(async (targetChannelId, options = {}) => {
    // Check recording conflict
    if (activeVoiceChannelId && activeVoiceChannelId !== targetChannelId) {
      const isRecording = !!activeVoiceRecordings[activeVoiceChannelId];
      if (isRecording && !options.force && !options.confirmedStopRecording) {
        showToast('warning', 'You are currently recording. Stop recording before switching channels.');
        return { needsStopConfirm: true };
      }
      if (isRecording) {
        await finishVoiceRecording(activeVoiceChannelId, 'channel_switch');
      }
      leaveVoiceChannel(activeVoiceChannelId);
    }

    // Check recording consent (target channel has active recording)
    const targetParticipants = voiceParticipants[targetChannelId] || {};
    const targetHasRecording = Object.values(targetParticipants).some((p) => p.isRecording);
    if (targetHasRecording && !options.confirmedTargetRecording) {
      return { needsConsent: true };
    }

    const channel = voiceChannels.find((c) => c.id === targetChannelId);
    if (!channel) {
      return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
    }

    if (!canAccessVoice(channel)) {
      return { ok: false, reason: 'NO_ACCESS' };
    }

    if (channel.speakPermission === 'TEAM' && !channel.allowedTeamIds?.length) {
      showToast('error', 'This voice channel is restricted to specific teams and no teams are assigned.');
      return { ok: false, reason: 'NO_TEAMS_ASSIGNED' };
    }

    const recordingConsent = channel.allowRecording !== false;
    setActiveVoiceChannelId(targetChannelId);
    setVoiceParticipants((prev) => ({
      ...prev,
      [targetChannelId]: {
        ...(prev[targetChannelId] || {}),
        [currentUser?.id]: {
          userId: currentUser?.id,
          userName: currentUser?.name,
          avatar: currentUser?.avatar,
          role: workspaceRole,
          recordingConsent,
          joinedAt: Date.now(),
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
          audioLevel: 0,
          streamId: null,
        },
      },
    }));

    return { ok: true };
  }, [activeVoiceChannelId, activeVoiceRecordings, voiceParticipants, voiceChannels, workspaceRole, currentUser, canAccessVoice, leaveVoiceChannel, finishVoiceRecording, showToast]);

  const startVoiceRecording = useCallback(async (channelId, providedStream, options = {}) => {
    const channel = voiceChannels.find((c) => c.id === channelId);
    if (!channel) {
      showToast('error', 'Voice channel not found.');
      return null;
    }

    if (!canRecordVoice(channel)) {
      showToast('error', 'You do not have permission to record in this voice channel.');
      return null;
    }

    if (activeVoiceRecordings[channelId]) {
      showToast('warning', 'Already recording in this channel.');
      return null;
    }

    if (!options.skipConsent && channel.recordingConsentEnabled !== false) {
      const participants = voiceParticipants[channelId] || {};
      const others = Object.values(participants).filter((p) => p.userId !== currentUser?.id);
      const allConsented = others.every((p) => p.recordingConsent === true);
      if (others.length > 0 && !allConsented) {
        showToast('error', 'Not all participants have consented to recording.');
        return null;
      }
    }

    try {
      const stream = providedStream || mediaStreamRefs.current[channelId];
      if (!stream) {
        showToast('error', 'No audio stream available. Join the voice channel first.');
        return null;
      }

      const processedResult = await createProcessedLocalRecordingStream({ localStream: stream });
      const processedStream = processedResult.stream;
      const mimeType = options.mimeType || 'audio/webm;codecs=opus';
      const recorderOptions = buildMediaRecorderOptions(mimeType);
      const recorder = new MediaRecorder(processedStream, recorderOptions);

      mediaChunkRefs.current[channelId] = [];

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) {
          const chunks = mediaChunkRefs.current[channelId];
          if (chunks) chunks.push(e.data);
        }
      };

      const startedAt = Date.now();
      setActiveVoiceRecordings((prev) => ({
        ...prev,
        [channelId]: {
          channelId,
          startedBy: currentUser?.id,
          startedAt,
          mimeType,
          duration: 0,
          size: 0,
          recordingMode: options.recordingMode || 'LOCAL_ONLY',
        },
      }));

      recorder.start(1000);
      mediaRecorderRefs.current[channelId] = recorder;
      mediaCleanupRefs.current[channelId] = processedResult.cleanup;

      if (!mediaStreamRefs.current[channelId]) {
        mediaStreamRefs.current[channelId] = stream;
      }

      // Mark participant as recording
      updateVoiceParticipantState(channelId, currentUser?.id, { isRecording: true, recordingSince: startedAt });

      showToast('success', 'Recording started.');
      return { ok: true, channelId, startedAt };
    } catch (err) {
      showToast('error', 'Failed to start recording: ' + (err.message || 'Unknown error'));
      return null;
    }
  }, [voiceChannels, canRecordVoice, activeVoiceRecordings, voiceParticipants, currentUser, showToast, updateVoiceParticipantState]);

  const stopVoiceRecording = useCallback((channelId, reason = 'manual') => {
    return finishVoiceRecording(channelId, reason);
  }, [finishVoiceRecording]);

  const getActiveVoiceRecordingMetrics = useCallback((channelId) => {
    const recording = activeVoiceRecordings[channelId];
    if (!recording) return null;
    const chunks = mediaChunkRefs.current[channelId] || [];
    const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
    const duration = (Date.now() - recording.startedAt) / 1000;
    return { duration, size: totalSize };
  }, [activeVoiceRecordings]);

  const updateVoiceChannelPermissions = useCallback((channelId, updates) => {
    if (!['OWNER', 'VICE_ADMIN'].includes(workspaceRole)) {
      showToast('error', 'Only workspace owners can change voice channel permissions.');
      return;
    }

    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== activeWorkspaceId) return ws;
        return {
          ...ws,
          channels: ws.channels.map((ch) => {
            if (ch.id !== channelId || ch.type !== 'voice') return ch;
            const normalized = normalizeVoiceChannel({ ...ch, ...updates });
            return { ...ch, ...normalized };
          }),
        };
      })
    );
  }, [workspaceRole, activeWorkspaceId, setWorkspaces, showToast]);

  const addTeamToVoiceChannel = useCallback((channelId, teamId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== activeWorkspaceId) return ws;
        return {
          ...ws,
          channels: ws.channels.map((ch) => {
            if (ch.id !== channelId || ch.type !== 'voice') return ch;
            const teams = ch.allowedTeamIds || [];
            return teams.includes(teamId) ? ch : { ...ch, allowedTeamIds: [...teams, teamId] };
          }),
        };
      })
    );
  }, [activeWorkspaceId, setWorkspaces]);

  const removeTeamFromVoiceChannel = useCallback((channelId, teamId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== activeWorkspaceId) return ws;
        return {
          ...ws,
          channels: ws.channels.map((ch) => {
            if (ch.id !== channelId || ch.type !== 'voice') return ch;
            return { ...ch, allowedTeamIds: (ch.allowedTeamIds || []).filter((t) => t !== teamId) };
          }),
        };
      })
    );
  }, [activeWorkspaceId, setWorkspaces]);

  const addUserToVoiceChannel = useCallback((channelId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== activeWorkspaceId) return ws;
        return {
          ...ws,
          channels: ws.channels.map((ch) => {
            if (ch.id !== channelId || ch.type !== 'voice') return ch;
            const users = ch.allowedUserIds || [];
            return users.includes(userId) ? ch : { ...ch, allowedUserIds: [...users, userId] };
          }),
        };
      })
    );
  }, [activeWorkspaceId, setWorkspaces]);

  const removeUserFromVoiceChannel = useCallback((channelId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== activeWorkspaceId) return ws;
        return {
          ...ws,
          channels: ws.channels.map((ch) => {
            if (ch.id !== channelId || ch.type !== 'voice') return ch;
            return { ...ch, allowedUserIds: (ch.allowedUserIds || []).filter((u) => u !== userId) };
          }),
        };
      })
    );
  }, [activeWorkspaceId, setWorkspaces]);

  const toggleVoiceChannelLock = useCallback((channelId, isLocked) => {
    updateVoiceChannelPermissions(channelId, { lockState: isLocked ? 'LOCKED' : 'UNLOCKED' });
  }, [updateVoiceChannelPermissions]);

  const toggleVoiceRecordingPermission = useCallback((channelId, allowRecording) => {
    updateVoiceChannelPermissions(channelId, { allowRecording });
  }, [updateVoiceChannelPermissions]);

  const deleteVoiceRecord = useCallback((recordId) => {
    setVoiceRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, status: 'DELETED' } : r))
    );
    const record = voiceRecordsRef.current.find((r) => r.id === recordId);
    if (record?.url && record.url.startsWith('blob:')) {
      URL.revokeObjectURL(record.url);
    }
  }, []);

  const sendVoiceRecordToAI = useCallback(async (recordId) => {
    const record = voiceRecordsRef.current.find((r) => r.id === recordId);
    if (!record) {
      showToast('error', 'Voice record not found.');
      return;
    }

    const channel = voiceChannels.find((c) => c.id === record.channelId);
    if (!channel || !canAccessVoice(channel)) {
      showToast('error', 'Voice channel not found or access denied.');
      return;
    }

    if (!canManageAIReview) {
      showToast('error', 'You do not have permission to use AI features.');
      return;
    }

    const meetingId = 'mtg-' + generateId();
    const newMeeting = {
      id: meetingId,
      title: channel?.name ? `Voice Recording - ${channel.name}` : 'Voice Recording',
      departmentId: activeWorkspaceId,
      uploadedBy: currentUser?.id,
      transcriptText: '',
      audioUrl: record.url || null,
      summary: null,
      status: 'PROCESSING',
      suggestions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkspaceMeetings((prev) => [newMeeting, ...prev]);
    addActivity('voice_record_sent_to_ai', 'Voice record sent for AI processing', { meetingId });
    showToast('success', 'Voice record sent to AI Meeting Flow.');
    return newMeeting;
  }, [voiceChannels, activeWorkspaceId, canManageAIReview, currentUser, canAccessVoice, setWorkspaceMeetings, addActivity, showToast]);

  // ─── Voice cleanup on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      Object.values(mediaRecorderRefs.current).forEach((r) => {
        try { if (r.state !== 'inactive') r.stop(); } catch { /* ignore */ }
      });
      Object.values(mediaStreamRefs.current).forEach((s) => {
        try { s.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      });
      Object.values(mediaChunkRefs.current).forEach((chunks) => {
        chunks.forEach((c) => {
          try { if (c?.url?.startsWith?.('blob:')) URL.revokeObjectURL(c.url); } catch { /* ignore */ }
        });
      });
    };
  }, []);

  return {
    // State
    voiceParticipants,
    activeVoiceChannelId,
    activeVoiceRecordings,
    voiceRecords,
    // Actions
    updateVoiceParticipantState,
    syncVoiceParticipant,
    removeVoiceParticipant,
    setVoiceChannelParticipants,
    joinVoiceChannel,
    leaveVoiceChannel,
    switchVoiceChannel,
    getCurrentUserVoiceChannel,
    isCurrentUserInVoice,
    removeUserFromAllVoiceChannels,
    startVoiceRecording,
    stopVoiceRecording,
    getActiveVoiceRecordingMetrics,
    updateVoiceChannelPermissions,
    addTeamToVoiceChannel,
    removeTeamFromVoiceChannel,
    addUserToVoiceChannel,
    removeUserFromVoiceChannel,
    toggleVoiceChannelLock,
    toggleVoiceRecordingPermission,
    sendVoiceRecordToAI,
    deleteVoiceRecord,
  };
}
