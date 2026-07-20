'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useSocket from '@/hooks/useSocket';
import useWebRTC from '@/hooks/useWebRTC';

function displayNameFromEmail(email) {
  return typeof email === 'string' && email.includes('@') ? email.split('@')[0] : '';
}

// ─── Global socket ref for modules that need to emit ———————————
// Set by VoiceConnectionProvider whenever the socket connects.
// Other hooks (e.g., useInvitationsState) can use this to emit events
// without needing a direct dependency on the context.
let _globalSocket = null;
let _readyWorkspaceId = null;
const pendingWorkspaceEvents = [];
export function getGlobalSocket() { return _globalSocket; }
export function emitWorkspaceRealtimeEvent(event) {
  if (!event?.workspaceId || !event?.type) return false;
  if (_globalSocket?.connected && _readyWorkspaceId === event.workspaceId) {
    _globalSocket.emit('workspace:event', event);
    return true;
  }
  pendingWorkspaceEvents.push(event);
  if (pendingWorkspaceEvents.length > 100) pendingWorkspaceEvents.shift();
  return false;
}

function flushPendingWorkspaceEvents(socket, workspaceId) {
  if (!socket?.connected || !workspaceId) return;
  const remaining = [];
  pendingWorkspaceEvents.splice(0).forEach((event) => {
    if (event.workspaceId === workspaceId) socket.emit('workspace:event', event);
    else remaining.push(event);
  });
  pendingWorkspaceEvents.push(...remaining);
}

/**
 * VoiceConnectionContext — real-time voice state (WebRTC + Socket.IO).
 *
 * This is separate from WorkspaceContext to keep concerns clean:
 *   - WorkspaceContext: recording, permissions, local participant state
 *   - VoiceConnectionContext: WebRTC peer connections, signaling, remote streams
 *
 * VoiceChannelView orchestrates both: it calls join/leave on both contexts.
 */
const VoiceConnectionContext = createContext(null);

export function VoiceConnectionProvider({ children, currentUser, workspaceId, workspaceRole }) {
  // ─── Socket.IO connection ──────────────────────────────────
  const socket = useSocket({ autoConnect: Boolean(currentUser?.id) });

  // ─── Channel state ─────────────────────────────────────────
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);
  const [activeVoiceWorkspaceId, setActiveVoiceWorkspaceId] = useState(null);
  const activeVoiceChannelIdRef = useRef(null);
  const [presenceByChannel, setPresenceByChannel] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const workspacePresenceUser = useMemo(() => {
    if (!currentUser?.id) return null;
    const name = currentUser.name || currentUser.nickname || displayNameFromEmail(currentUser.email) || 'Member';
    return {
      id: currentUser.id,
      name,
      email: currentUser.email || '',
      avatar: currentUser.avatar || null,
      role: workspaceRole || currentUser.role || 'Member',
      workspaceRole: workspaceRole || currentUser.role || 'Member',
    };
  }, [
    currentUser?.id,
    currentUser?.name,
    currentUser?.email,
    currentUser?.avatar,
    currentUser?.role,
    workspaceRole,
  ]);

  // ─── Local mic stream (managed by VoiceChannelView) ────────
  const localStreamRef = useRef(null);
  const [localStream, setLocalStreamState] = useState(null);

  const setLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStreamState(stream);
  }, []);

  // ─── Local mic muted state ────────────────────────────────
  const [localMicMuted, setLocalMicMuted] = useState(false);

  // ─── Local speaking state ref (updated by VoiceChannelView) ─
  const localSpeakingRef = useRef({ isSpeaking: false, isMuted: false });
  const [localSpeakingState, setLocalSpeakingState] = useState({ isSpeaking: false, audioLevel: 0 });

  /**
   * Set local speaking state (called by VoiceChannelView when VAD changes).
   * Only the `isSpeaking` boolean is pushed — audioLevel is local-only for UI.
   */
  const setLocalSpeaking = useCallback(({ isSpeaking, audioLevel = 0 }) => {
    localSpeakingRef.current = {
      ...localSpeakingRef.current,
      isSpeaking,
      isMuted: localMicMuted,
    };
    setLocalSpeakingState({ isSpeaking, audioLevel });
  }, [localMicMuted]);

  // Keep speaking ref sync'd with mute state
  useEffect(() => {
    localSpeakingRef.current = {
      ...localSpeakingRef.current,
      isMuted: localMicMuted,
    };
  }, [localMicMuted]);

  // ─── WebRTC mesh ──────────────────────────────────────────
  const webrtc = useWebRTC({
    localStream,
    workspaceId: activeVoiceWorkspaceId || workspaceId,
    channelId: activeVoiceChannelId,
    socket: socket.socket,
    userId: currentUser?.id,
    userName: workspacePresenceUser?.name || '',
    userRole: workspaceRole,
    userAvatar: currentUser?.avatar,
    isMuted: localMicMuted,
    enabled: !!activeVoiceChannelId && socket.connected,
    speakingState: localSpeakingState,
  });

  useEffect(() => {
    if (!socket.socket || !socket.connected || !workspaceId) return undefined;
    const handleSnapshot = ({ workspaceId: eventWorkspaceId, participantsByChannel }) => {
      if (eventWorkspaceId !== workspaceId) return;
      setPresenceByChannel(participantsByChannel || {});
    };
    const handleUpdate = ({ workspaceId: eventWorkspaceId, channelId, participants }) => {
      if (eventWorkspaceId !== workspaceId || !channelId) return;
      setPresenceByChannel((prev) => ({ ...prev, [channelId]: participants || [] }));
    };
    const handleWorkspacePresence = ({ workspaceId: eventWorkspaceId, onlineUsers: nextOnlineUsers }) => {
      if (eventWorkspaceId !== workspaceId) return;
      _readyWorkspaceId = workspaceId;
      setOnlineUsers(nextOnlineUsers || []);
      flushPendingWorkspaceEvents(socket.socket, workspaceId);
    };
    const handleWorkspaceEvent = (event) => {
      if (event?.workspaceId !== workspaceId) return;
      window.dispatchEvent(new CustomEvent('workspace:realtime', { detail: event }));
    };
    socket.socket.on('voice:presence:snapshot', handleSnapshot);
    socket.socket.on('voice:presence:update', handleUpdate);
    socket.socket.on('workspace:presence:snapshot', handleWorkspacePresence);
    socket.socket.on('workspace:presence:update', handleWorkspacePresence);
    socket.socket.on('workspace:event', handleWorkspaceEvent);
    socket.socket.emit('workspace:join', { workspaceId, user: workspacePresenceUser });
    const heartbeat = setInterval(() => {
      socket.socket?.emit('workspace:presence:heartbeat', {
        workspaceId,
        userId: workspacePresenceUser?.id,
        user: workspacePresenceUser,
      });
      socket.socket?.emit('workspace:presence:get', { workspaceId });
    }, 15000);
    return () => {
      socket.socket?.off('voice:presence:snapshot', handleSnapshot);
      socket.socket?.off('voice:presence:update', handleUpdate);
      socket.socket?.off('workspace:presence:snapshot', handleWorkspacePresence);
      socket.socket?.off('workspace:presence:update', handleWorkspacePresence);
      socket.socket?.off('workspace:event', handleWorkspaceEvent);
      clearInterval(heartbeat);
      if (_readyWorkspaceId === workspaceId) _readyWorkspaceId = null;
    };
  }, [socket.connected, socket.socket, workspaceId, workspacePresenceUser]);

  // ─── Global socket + invitation relay ───────────────────
  useEffect(() => {
    const sock = socket.socket;
    if (!sock) return undefined;
    // Expose socket globally so useInvitationsState can emit events
    _globalSocket = sock;
    const announceOnline = () => {
      if (!currentUser?.id) return;
      sock.emit('user:online', {
        userId: currentUser.id,
        email: currentUser.email,
      });
    };
    if (socket.connected) announceOnline();
    sock.on('connect', announceOnline);
    // Relay invitation events from signaling server → window events
    const handleInvitationNew = (invitation) => {
      window.dispatchEvent(new CustomEvent('invitation:new', { detail: invitation }));
    };
    const handleInvitationAccepted = (data) => {
      window.dispatchEvent(new CustomEvent('invitation:accepted', { detail: data }));
    };
    sock.on('invitation:new', handleInvitationNew);
    sock.on('invitation:accepted', handleInvitationAccepted);
    return () => {
      if (_globalSocket === sock) _globalSocket = null;
      sock.off('connect', announceOnline);
      sock.off('invitation:new', handleInvitationNew);
      sock.off('invitation:accepted', handleInvitationAccepted);
    };
  }, [currentUser?.id, currentUser?.email, socket.connected, socket.socket]);

  // ─── Join voice channel (WebRTC + signaling) ─────────────
  const voiceJoinChannel = useCallback(async (channelId, options = {}) => {
    if (!channelId || !currentUser?.id) return;
    const targetWorkspaceId = options.workspaceId || workspaceId;
    const switchingSession = activeVoiceChannelIdRef.current && (
      activeVoiceChannelIdRef.current !== channelId || activeVoiceWorkspaceId !== targetWorkspaceId
    );
    if (switchingSession) webrtc.leaveChannel();
    setActiveVoiceWorkspaceId(targetWorkspaceId || null);
    setActiveVoiceChannelId(channelId);
    activeVoiceChannelIdRef.current = channelId;
    // useWebRTC joins after channel/workspace state has committed.
  }, [activeVoiceWorkspaceId, currentUser?.id, webrtc, workspaceId]);

  // ─── Leave voice channel ──────────────────────────────────
  const voiceLeaveChannel = useCallback(async () => {
    webrtc.leaveChannel();
    localStreamRef.current?.getTracks?.().forEach((track) => {
      if (track.readyState !== 'ended') track.stop();
    });
    setActiveVoiceChannelId(null);
    setActiveVoiceWorkspaceId(null);
    activeVoiceChannelIdRef.current = null;
    setLocalStream(null);
    localStreamRef.current = null;
    localSpeakingRef.current = { isSpeaking: false, isMuted: false };
    setLocalSpeakingState({ isSpeaking: false, audioLevel: 0 });
    setLocalMicMuted(false);
  }, [webrtc, setLocalStream]);

  useEffect(() => {
    if (currentUser?.id || !activeVoiceChannelIdRef.current) return;
    voiceLeaveChannel();
  }, [currentUser?.id, voiceLeaveChannel]);

  useEffect(() => {
    const sock = socket.socket;
    if (!sock) return undefined;
    const handleSessionReplaced = () => {
      localStreamRef.current?.getTracks?.().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
      setActiveVoiceChannelId(null);
      setActiveVoiceWorkspaceId(null);
      activeVoiceChannelIdRef.current = null;
      setLocalStream(null);
      setLocalSpeakingState({ isSpeaking: false, audioLevel: 0 });
      window.dispatchEvent(new CustomEvent('voice:session-replaced'));
    };
    sock.on('voice:session-replaced', handleSessionReplaced);
    return () => sock.off('voice:session-replaced', handleSessionReplaced);
  }, [setLocalStream, socket.socket]);

  // ─── Remote participants (derived) ─────────────────────────
  // Merge peerStates + remoteStreams into a single map for easy consumption
  const remoteParticipants = useMemo(() => {
    const result = new Map();
    const states = webrtc.peerStates;
    const streams = webrtc.remoteStreams;

    for (const [userId, state] of states.entries()) {
      result.set(userId, {
        ...state,
        stream: streams.get(userId) || null,
      });
    }
    return result;
  }, [webrtc.peerStates, webrtc.remoteStreams]);

  // ─── Connection status — Discord-like separation ────────────
  /**
   * signalingStatus — Socket.IO link to signaling server.
   *   disconnected | connected | reconnecting
   */
  const signalingStatus = useMemo(() => {
    if (socket.heartbeatLost) return 'reconnecting';
    if (socket.connected) return 'connected';
    return 'disconnected';
  }, [socket.connected, socket.heartbeatLost]);

  /**
   * voicePeerStatus — WebRTC peer mesh state.
   *   idle           — not in a voice channel
   *   waiting        — in channel, no remote peers (solo room)
   *   connecting     — in channel, peers exist but connections not established
   *   connected      — at least one peer connected
   *   poor           — connected but high latency
   */
  const voicePeerStatus = useMemo(() => {
    if (!activeVoiceChannelId) return 'idle';
    const peerCount = webrtc.peerStates.size;
    const connectedPeers = Array.from(webrtc.peerStates.values()).filter((p) => p.connected);
    if (peerCount === 0) return 'waiting';
    if (connectedPeers.length === 0) return 'connecting';
    if (socket.latencyMs > 300) return 'poor';
    return 'connected';
  }, [activeVoiceChannelId, webrtc.peerStates, socket.latencyMs]);

  /**
   * micStatus — local microphone state.
   *   active | muted | ended | permission-denied
   */
  const micStatus = useMemo(() => {
    if (!activeVoiceChannelId) return 'inactive';
    return localMicMuted ? 'muted' : 'active';
  }, [activeVoiceChannelId, localMicMuted]);

  // Backward-compatible aliases
  const voiceConnected = socket.connected && !!activeVoiceChannelId;
  const connectionQuality = voiceConnected ? socket.connectionQuality : 'disconnected';
  const hasRemotePeers = webrtc.peerStates.size > 0;
  const socketLatencyMs = socket.latencyMs ?? null;

  /**
   * Unified voice connection state — single source of truth for the UI.
   *
   *   disconnected  — socket not connected or not in a voice channel
   *   connecting    — socket connected, joining channel, no remote peers yet
   *   connected     — socket connected + in a channel (may have remote peers or be alone)
   *   poor          — connected but high latency
   *   reconnecting  — heartbeat lost, trying to recover
   */
  const voiceConnectionState = useMemo(() => {
    if (!activeVoiceChannelId) return 'idle';
    if (!localStream) return 'requesting-mic';
    if (socket.heartbeatLost) return 'reconnecting';
    if (!socket.connected) return 'reconnecting';
    if (socket.latencyMs > 300) return 'poor';
    if (webrtc.peerStates.size > 0 && Array.from(webrtc.peerStates.values()).every((peer) => !peer.connected)) return 'connecting';
    return 'connected';
  }, [socket.connected, socket.heartbeatLost, socket.latencyMs, activeVoiceChannelId, localStream, webrtc.peerStates]);

  // ─── Context value ────────────────────────────────────────
  const value = useMemo(() => ({
    // Connection
    voiceConnected,
    connectionQuality,
    voiceConnectionState,
    socketLatencyMs: socket.latencyMs,
    voiceServerUrl: socket.url,
    voiceServerUnreachable: !socket.connected || socket.heartbeatLost,
    lastSocketEvent: socket.lastSocketEvent,
    hasRemotePeers,

    // Discord-like status separation
    signalingStatus,
    voicePeerStatus,
    micStatus,
    activeVoiceWorkspaceId,

    // Join/leave
    voiceJoinChannel,
    voiceLeaveChannel,

    // Streams
    localStream,
    setLocalStream,
    remoteStreams: webrtc.remoteStreams,
    remoteParticipants,
    presenceByChannel,
    onlineUsers,
    audioWarning: webrtc.audioWarning,
    peerStates: webrtc.peerStates,
    peerCount: webrtc.peerCount,
    turnConfigured: webrtc.turnConfigured,
    stunConfigured: webrtc.stunConfigured,
    rtcConfiguration: webrtc.rtcConfiguration,
    lastWebRTCError: webrtc.lastWebRTCError,

    // State setters for VoiceChannelView
    setLocalSpeaking,
    setLocalMicMuted,
    localMicMuted,
  }), [
    voiceConnected,
    connectionQuality,
    voiceConnectionState,
    signalingStatus,
    voicePeerStatus,
    micStatus,
    activeVoiceWorkspaceId,
    socketLatencyMs,
    socket.url,
    socket.lastSocketEvent,
    socket.connected,
    socket.heartbeatLost,
    hasRemotePeers,
    voiceJoinChannel,
    voiceLeaveChannel,
    localStream,
    setLocalStream,
    webrtc.remoteStreams,
    remoteParticipants,
    presenceByChannel,
    onlineUsers,
    webrtc.audioWarning,
    webrtc.peerStates,
    webrtc.peerCount,
    webrtc.turnConfigured,
    webrtc.stunConfigured,
    webrtc.rtcConfiguration,
    webrtc.lastWebRTCError,
    setLocalSpeaking,
    setLocalMicMuted,
    localMicMuted,
  ]);

  return (
    <VoiceConnectionContext.Provider value={value}>
      {children}
    </VoiceConnectionContext.Provider>
  );
}

/**
 * Hook to access voice connection state.
 */
export function useVoiceConnection() {
  const ctx = useContext(VoiceConnectionContext);
  if (!ctx) {
    throw new Error('useVoiceConnection must be used within VoiceConnectionProvider');
  }
  return ctx;
}

export default VoiceConnectionContext;
