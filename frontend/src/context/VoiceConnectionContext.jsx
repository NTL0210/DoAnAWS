'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useSocket from '@/hooks/useSocket';
import useWebRTC from '@/hooks/useWebRTC';

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
  const socket = useSocket({ autoConnect: true });

  // ─── Channel state ─────────────────────────────────────────
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);
  const activeVoiceChannelIdRef = useRef(null);
  const [presenceByChannel, setPresenceByChannel] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);

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
    workspaceId,
    channelId: activeVoiceChannelId,
    socket: socket.socket,
    userId: currentUser?.id,
    userName: currentUser?.name,
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
      setOnlineUsers(nextOnlineUsers || []);
    };
    socket.socket.on('voice:presence:snapshot', handleSnapshot);
    socket.socket.on('voice:presence:update', handleUpdate);
    socket.socket.on('workspace:presence:snapshot', handleWorkspacePresence);
    socket.socket.on('workspace:presence:update', handleWorkspacePresence);
    socket.socket.emit('workspace:join', { workspaceId, user: currentUser });
    return () => {
      socket.socket?.off('voice:presence:snapshot', handleSnapshot);
      socket.socket?.off('voice:presence:update', handleUpdate);
      socket.socket?.off('workspace:presence:snapshot', handleWorkspacePresence);
      socket.socket?.off('workspace:presence:update', handleWorkspacePresence);
    };
  }, [currentUser, socket.connected, socket.socket, workspaceId]);

  // ─── Join voice channel (WebRTC + signaling) ─────────────
  const voiceJoinChannel = useCallback(async (channelId, options = {}) => {
    if (!channelId || !currentUser?.id) return;
    setActiveVoiceChannelId(channelId);
    activeVoiceChannelIdRef.current = channelId;
    // useWebRTC's joinChannel will fire via its effect when channelId changes
    webrtc.joinChannel(channelId, options);
  }, [currentUser, webrtc]);

  // ─── Leave voice channel ──────────────────────────────────
  const voiceLeaveChannel = useCallback(async () => {
    webrtc.leaveChannel();
    setActiveVoiceChannelId(null);
    activeVoiceChannelIdRef.current = null;
    setLocalStream(null);
    localStreamRef.current = null;
    localSpeakingRef.current = { isSpeaking: false, isMuted: false };
    setLocalSpeakingState({ isSpeaking: false, audioLevel: 0 });
    setLocalMicMuted(false);
  }, [webrtc, setLocalStream]);

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
