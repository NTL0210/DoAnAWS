'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import useThrottledCallback from './useThrottledCallback';
import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';
import {
  getVoiceRtcConfig,
  getSafeRtcConfigForLog,
  hasTurnServer,
  hasStunServer,
  getSelectedCandidateInfo,
  classifyCandidate,
} from '@/config/voiceRtcConfig';

const DEBUG = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function debugLog(...args) {
  if (DEBUG) console.info('[Voice/WebRTC]', ...args);
}

function summarizeWebRTCStats(report) {
  const summary = {
    roundTripTime: null,
    jitter: null,
    packetsLost: 0,
    packetsSent: 0,
    packetsReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
  };

  report.forEach((stat) => {
    if (stat.type === 'candidate-pair' && (stat.nominated || stat.state === 'succeeded') && typeof stat.currentRoundTripTime === 'number') {
      summary.roundTripTime = stat.currentRoundTripTime;
    }
    if (stat.type === 'remote-inbound-rtp' && stat.kind === 'audio' && typeof stat.roundTripTime === 'number') {
      summary.roundTripTime = stat.roundTripTime;
    }
    if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
      summary.jitter = typeof stat.jitter === 'number' ? stat.jitter : summary.jitter;
      summary.packetsLost += Number(stat.packetsLost) || 0;
      summary.packetsReceived += Number(stat.packetsReceived) || 0;
      summary.bytesReceived += Number(stat.bytesReceived) || 0;
    }
    if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
      summary.packetsSent += Number(stat.packetsSent) || 0;
      summary.bytesSent += Number(stat.bytesSent) || 0;
    }
  });

  return summary;
}

async function applyAudioSenderParameters(sender) {
  if (!sender?.getParameters || !sender?.setParameters) return;
  const params = sender.getParameters();
  params.encodings = params.encodings?.length ? params.encodings : [{}];
  params.encodings = params.encodings.map((encoding) => ({
    ...encoding,
    maxBitrate: VOICE_AUDIO_CONFIG.senderMaxBitrate,
  }));
  if ('dtx' in params.encodings[0]) params.encodings[0].dtx = VOICE_AUDIO_CONFIG.senderDtx;
  try {
    await sender.setParameters(params);
  } catch (error) {
    debugLog('set audio sender params failed', error.message);
  }
}

export default function useWebRTC(opts) {
  const {
    localStream = null,
    workspaceId = null,
    channelId = null,
    socket = null,
    userId = null,
    userName = '',
    userRole = '',
    userAvatar = null,
    isMuted = false,
    enabled = true,
    speakingState = { isSpeaking: false, audioLevel: 0 },
  } = opts;

  const rtcConfiguration = useMemo(() => {
    const config = getVoiceRtcConfig();
    if (DEBUG) {
      console.info('[Voice/WebRTC] RTC config:', getSafeRtcConfigForLog(config));
    }
    return config;
  }, []);
  const localStreamRef = useRef(localStream);
  const peersRef = useRef(new Map());
  const peerMetaRef = useRef(new Map());
  const socketUserMapRef = useRef(new Map());
  const dataChannelsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const pingIntervalsRef = useRef(new Map());
  const reconnectTimersRef = useRef(new Map());
  const statsIntervalRef = useRef(null);
  const previousLocalTrackIdRef = useRef(null);
  const joinedRef = useRef(false);
  const cleanupsRef = useRef([]);
  const joiningRef = useRef(false);
  const speakingStateRef = useRef(speakingState);
  const isMutedRef = useRef(isMuted);

  /** ICE candidates that arrived before setRemoteDescription — keyed by peerUserId */
  const pendingIceCandidatesRef = useRef(new Map());
  /** Interval for polling selected candidate-pair info */
  const candidateInfoIntervalRef = useRef(null);

  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [peerStates, setPeerStates] = useState(new Map());
  const [peerCount, setPeerCount] = useState(0);
  const [audioWarning, setAudioWarning] = useState('');
  const [lastWebRTCError, setLastWebRTCError] = useState('');
  const lastBroadcastSpeakingRef = useRef({ isSpeaking: false, audioLevel: 0 });

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    speakingStateRef.current = speakingState;
  }, [speakingState]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (!hasTurnServer(rtcConfiguration)) {
      const warning = 'TURN server is not configured. Voice may fail across different networks/NAT.';
      debugLog(warning);
      setAudioWarning((prev) => prev || warning);
    }
  }, [rtcConfiguration]);

  const updatePeerState = useCallback((peerUserId, patch) => {
    if (!peerUserId) return;
    setPeerStates((prev) => {
      const next = new Map(prev);
      next.set(peerUserId, { ...(next.get(peerUserId) || {}), ...patch });
      return next;
    });
  }, []);

  // ─── ICE candidate queue — candidates arriving before setRemoteDescription ───

  /** @param {string} peerUserId */
  const flushQueuedIceCandidates = useCallback(async (peerUserId) => {
    const pc = peersRef.current.get(peerUserId);
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingIceCandidatesRef.current.get(peerUserId);
    if (!queue || queue.length === 0) return;
    pendingIceCandidatesRef.current.delete(peerUserId);
    if (DEBUG) debugLog('flush queued ICE candidates', peerUserId, queue.length);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (err.name !== 'InvalidStateError') {
          debugLog('flush queued ICE candidate failed', peerUserId, err.message);
        }
      }
    }
  }, []);

  /** @param {string} peerUserId @param {RTCIceCandidate} candidate */
  const queueIceCandidate = useCallback((peerUserId, candidate) => {
    if (!peerUserId || !candidate) return;
    const queue = pendingIceCandidatesRef.current.get(peerUserId) || [];
    queue.push(candidate);
    pendingIceCandidatesRef.current.set(peerUserId, queue);
    if (DEBUG) debugLog('queued ICE candidate (no remote desc yet)', peerUserId, queue.length);
  }, []);

  const clearPing = useCallback((peerUserId) => {
    const intervalId = pingIntervalsRef.current.get(peerUserId);
    if (intervalId) clearInterval(intervalId);
    pingIntervalsRef.current.delete(peerUserId);
  }, []);

  const clearReconnectTimer = useCallback((peerUserId) => {
    const timer = reconnectTimersRef.current.get(peerUserId);
    if (timer) clearTimeout(timer);
    reconnectTimersRef.current.delete(peerUserId);
  }, []);

  const cleanupPeer = useCallback((peerUserId) => {
    if (!peerUserId) return;
    clearPing(peerUserId);
    clearReconnectTimer(peerUserId);
    const dc = dataChannelsRef.current.get(peerUserId);
    if (dc) {
      try { dc.close(); } catch (e) { /* noop */ }
      dataChannelsRef.current.delete(peerUserId);
    }
    const pc = peersRef.current.get(peerUserId);
    if (pc) {
      try { pc.close(); } catch (e) { /* noop */ }
      peersRef.current.delete(peerUserId);
    }
    // Clean up ICE candidate queue and pending data
    pendingIceCandidatesRef.current.delete(peerUserId);
    const meta = peerMetaRef.current.get(peerUserId);
    if (meta?.socketId) socketUserMapRef.current.delete(meta.socketId);
    peerMetaRef.current.delete(peerUserId);
    remoteStreamsRef.current.delete(peerUserId);
    setRemoteStreams(new Map(remoteStreamsRef.current));
    setPeerStates((prev) => {
      const next = new Map(prev);
      next.delete(peerUserId);
      return next;
    });
    setPeerCount(peersRef.current.size);
  }, [clearPing, clearReconnectTimer]);

  const setupDataChannel = useCallback((peerUserId, channel) => {
    if (!peerUserId || !channel) return;
    dataChannelsRef.current.set(peerUserId, channel);

    channel.onopen = () => {
      debugLog('data channel open', peerUserId);
      try {
        channel.send(JSON.stringify({ type: 'mute', isMuted: isMutedRef.current }));
        channel.send(JSON.stringify({ type: 'speaking', ...(speakingStateRef.current || { isSpeaking: false, audioLevel: 0 }) }));
      } catch (e) {
        debugLog('data channel initial state send failed', peerUserId, e.message);
      }
    };
    channel.onclose = () => dataChannelsRef.current.delete(peerUserId);
    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'speaking') {
          setPeerStates((prev) => {
            const next = new Map(prev);
            const current = next.get(peerUserId) || {};
            next.set(peerUserId, {
              ...current,
              isSpeaking: current.isMuted ? false : Boolean(msg.isSpeaking),
              audioLevel: current.isMuted ? 0 : Number(msg.audioLevel) || 0,
            });
            return next;
          });
        }
        if (msg.type === 'mute') {
          updatePeerState(peerUserId, {
            isMuted: Boolean(msg.isMuted),
            ...(msg.isMuted ? { isSpeaking: false, audioLevel: 0 } : {}),
          });
        }
        if (msg.type === 'ping' && channel.readyState === 'open') {
          channel.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
        }
        if (msg.type === 'pong') updatePeerState(peerUserId, { pingMs: Math.max(0, Date.now() - msg.timestamp) });
      } catch (e) {
        debugLog('data channel parse failed', e.message);
      }
    };
  }, [updatePeerState]);

  const startPeerPing = useCallback((peerUserId) => {
    clearPing(peerUserId);
    const intervalId = setInterval(() => {
      const dc = dataChannelsRef.current.get(peerUserId);
      if (dc?.readyState === 'open') {
        try { dc.send(JSON.stringify({ type: 'ping', timestamp: Date.now() })); } catch (e) { /* noop */ }
      }
    }, 5000);
    pingIntervalsRef.current.set(peerUserId, intervalId);
  }, [clearPing]);

  useEffect(() => {
    if (!enabled) return undefined;
    const collectStats = async () => {
      const tasks = Array.from(peersRef.current.entries()).map(async ([peerUserId, pc]) => {
        if (!pc || pc.connectionState === 'closed') return;
        try {
          const stats = summarizeWebRTCStats(await pc.getStats());
          const poorNetwork =
            (stats.jitter != null && stats.jitter > 0.05)
            || stats.packetsLost > 20;
          updatePeerState(peerUserId, { stats, poorNetwork });
        } catch (err) {
          setLastWebRTCError(`getStats failed for ${peerUserId}: ${err.message}`);
        }
      });
      await Promise.all(tasks);
    };
    collectStats();
    statsIntervalRef.current = setInterval(collectStats, 2500);
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    };
  }, [enabled, updatePeerState]);

  const addLocalTracks = useCallback((pc) => {
    if (!localStream) return;
    const [audioTrack] = localStream.getAudioTracks();
    if (!audioTrack || audioTrack.readyState !== 'live') return;
    const audioSender = pc.getSenders().find((sender) => sender.track?.kind === 'audio');
    if (!audioSender) applyAudioSenderParameters(pc.addTrack(audioTrack, localStream));
  }, [localStream]);

  const replaceLocalTracks = useCallback(async (nextStream) => {
    const [nextTrack] = nextStream?.getAudioTracks?.() || [];
    if (!nextTrack || nextTrack.readyState !== 'live') return;
    const replacements = [];
    peersRef.current.forEach((pc, peerUserId) => {
      if (!pc || pc.connectionState === 'closed') return;
      const audioSenders = pc.getSenders().filter((sender) => sender.track?.kind === 'audio');
      const [primarySender, ...duplicates] = audioSenders;
      duplicates.forEach((sender) => {
        try { pc.removeTrack(sender); } catch (err) { debugLog('remove duplicate sender failed', peerUserId, err.message); }
      });
      if (primarySender) {
        replacements.push(primarySender.replaceTrack(nextTrack).catch((err) => {
          setLastWebRTCError(`replaceTrack failed for ${peerUserId}: ${err.message}`);
          debugLog('replaceTrack failed', peerUserId, err.message);
        }));
      } else {
        try {
          const sender = pc.addTrack(nextTrack, nextStream);
          replacements.push(applyAudioSenderParameters(sender));
        } catch (err) {
          setLastWebRTCError(`addTrack failed for ${peerUserId}: ${err.message}`);
          debugLog('addTrack failed', peerUserId, err.message);
        }
      }
      const sender = pc.getSenders().find((item) => item.track?.kind === 'audio');
      if (sender) replacements.push(applyAudioSenderParameters(sender));
    });
    await Promise.all(replacements);
  }, []);

  const restartPeerIce = useCallback(async (peerUserId, reason = 'restart') => {
    const pc = peersRef.current.get(peerUserId);
    const peer = peerMetaRef.current.get(peerUserId);
    if (!pc || !peer || pc.connectionState === 'closed' || !socket?.connected) return;
    try {
      debugLog('restart ICE', peerUserId, reason);
      pc.restartIce?.();
      const offer = await pc.createOffer({ iceRestart: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { to: peer.socketId, from: socket.id, channelId, offer });
    } catch (err) {
      setLastWebRTCError(`ICE restart failed for ${peerUserId}: ${err.message}`);
      debugLog('restart ICE failed', peerUserId, err.message);
    }
  }, [channelId, socket]);

  /** Periodically poll selected candidate pair info and store in peer state. */
  const pollCandidateInfo = useCallback(async (peerUserId) => {
    const pc = peersRef.current.get(peerUserId);
    if (!pc || pc.connectionState === 'closed') return;
    const info = await getSelectedCandidateInfo(pc);
    if (info) {
      const localType = info.localCandidate?.type || 'unknown';
      const classification = classifyCandidate(localType);
      updatePeerState(peerUserId, {
        candidateInfo: info,
        candidateType: localType,
        candidateProtocol: info.localCandidate?.protocol || 'udp',
        candidateLabel: classification.label,
        isRelay: classification.isRelay,
      });
    }
  }, [updatePeerState]);

  const createPeerConnection = useCallback((peer) => {
    if (!peer?.userId || !peer?.socketId) return null;
    const existing = peersRef.current.get(peer.userId);
    if (existing && existing.connectionState !== 'closed') return existing;

    const pc = new RTCPeerConnection(rtcConfiguration);
    peerMetaRef.current.set(peer.userId, peer);
    socketUserMapRef.current.set(peer.socketId, peer.userId);
    addLocalTracks(pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        debugLog('send ice', peer.userId);
        socket.emit('webrtc:ice-candidate', {
          to: peer.socketId,
          from: socket.id,
          channelId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      debugLog('remote track received', peer.userId, {
        streamId: stream.id,
        audioTracks: stream.getAudioTracks().length,
        readyState: stream.getAudioTracks()[0]?.readyState,
      });
      remoteStreamsRef.current.set(peer.userId, stream);
      setRemoteStreams(new Map(remoteStreamsRef.current));
      updatePeerState(peer.userId, { hasAudio: true, connected: true });
    };

    pc.ondatachannel = (event) => setupDataChannel(peer.userId, event.channel);

    const updateConnection = () => {
      debugLog('peer state', peer.userId, {
        ice: pc.iceConnectionState,
        connection: pc.connectionState,
        signaling: pc.signalingState,
        gathering: pc.iceGatheringState,
      });
      updatePeerState(peer.userId, {
        iceState: pc.iceConnectionState,
        connectionState: pc.connectionState,
        signalingState: pc.signalingState,
        iceGatheringState: pc.iceGatheringState,
        connected: ['connected', 'completed'].includes(pc.iceConnectionState) || pc.connectionState === 'connected',
      });
      // Poll selected candidate pair info when connected
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        pollCandidateInfo(peer.userId);
        clearReconnectTimer(peer.userId);
      }
      if (pc.iceConnectionState === 'disconnected') {
        clearReconnectTimer(peer.userId);
        reconnectTimersRef.current.set(peer.userId, setTimeout(() => {
          const current = peersRef.current.get(peer.userId);
          if (current?.iceConnectionState === 'disconnected') restartPeerIce(peer.userId, 'disconnected-timeout');
        }, 4000));
      }
      if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
        clearReconnectTimer(peer.userId);
        restartPeerIce(peer.userId, 'failed');
      }
      if (pc.connectionState === 'closed') {
        cleanupPeer(peer.userId);
      }
    };
    pc.oniceconnectionstatechange = updateConnection;
    pc.onconnectionstatechange = updateConnection;
    pc.onsignalingstatechange = updateConnection;

    // Track ICE gathering state changes for candidate-type logging
    pc.onicegatheringstatechange = () => {
      debugLog('ice gathering state', peer.userId, pc.iceGatheringState);
      updatePeerState(peer.userId, {
        iceGatheringState: pc.iceGatheringState,
      });
      // When gathering is complete, poll the selected candidate pair
      if (pc.iceGatheringState === 'complete') {
        pollCandidateInfo(peer.userId);
      }
    };

    const dc = pc.createDataChannel('voice-sync', { ordered: true });
    setupDataChannel(peer.userId, dc);

    peersRef.current.set(peer.userId, pc);
    updatePeerState(peer.userId, {
      userId: peer.userId,
      socketId: peer.socketId,
      name: peer.name,
      avatar: peer.avatar,
      role: peer.role,
      isMuted: peer.isMuted || false,
      isSpeaking: false,
      audioLevel: 0,
      connected: false,
      hasAudio: false,
      iceState: 'new',
      connectionState: 'new',
      signalingState: 'new',
      iceGatheringState: 'new',
      // Candidate info (populated after ICE completes)
      candidateType: null,
      candidateProtocol: null,
      candidateLabel: null,
      isRelay: false,
      candidateInfo: null,
    });
    setPeerCount(peersRef.current.size);
    startPeerPing(peer.userId);
    return pc;
  }, [addLocalTracks, channelId, cleanupPeer, clearReconnectTimer, restartPeerIce, rtcConfiguration, setupDataChannel, socket, startPeerPing, updatePeerState, pollCandidateInfo]);

  const sendOffer = useCallback(async (peer) => {
    const pc = createPeerConnection(peer);
    if (!pc || !socket?.connected) return;
    try {
      debugLog('send offer', peer.userId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { to: peer.socketId, from: socket.id, channelId, offer });
    } catch (err) {
      console.error(`[Voice] Could not create audio offer for ${peer.name || peer.userId}:`, {
        error: err.message,
        errorName: err.name,
        signalingState: pc?.signalingState,
        iceConnectionState: pc?.iceConnectionState,
        connectionState: pc?.connectionState,
        hasLocalStream: !!localStreamRef.current,
        localTracks: localStreamRef.current?.getAudioTracks?.()?.map((t) => ({
          id: t.id,
          enabled: t.enabled,
          readyState: t.readyState,
        })) || [],
        peerUserId: peer.userId,
      });
      setAudioWarning(`Could not create audio offer for ${peer.name || peer.userId}.`);
      setLastWebRTCError(`offer failed: ${err.name} — ${err.message}`);
    }
  }, [channelId, createPeerConnection, socket]);

  const handleOffer = useCallback(async ({ from, offer }) => {
    const peerUserId = socketUserMapRef.current.get(from);
    if (!peerUserId || !offer) return;
    const peer = peerMetaRef.current.get(peerUserId) || { userId: peerUserId, socketId: from };
    const pc = createPeerConnection(peer);
    if (!pc || !socket?.connected) return;
    try {
      debugLog('received offer', peerUserId);
      if (pc.signalingState !== 'stable') {
        await Promise.all([
          pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
        ]);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Drain any ICE candidates that arrived before the remote description
      await flushQueuedIceCandidates(peerUserId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      debugLog('send answer', peerUserId);
      socket.emit('webrtc:answer', { to: from, from: socket.id, channelId, answer });
    } catch (err) {
      console.error(`[Voice] Could not answer audio connection for ${peer.name || peerUserId}:`, {
        error: err.message,
        errorName: err.name,
        signalingState: pc?.signalingState,
        iceConnectionState: pc?.iceConnectionState,
        iceGatheringState: pc?.iceGatheringState,
        connectionState: pc?.connectionState,
        remoteDescriptionSet: !!pc?.remoteDescription,
        hasLocalStream: !!localStreamRef.current,
        localTracks: localStreamRef.current?.getAudioTracks?.()?.map((t) => ({
          id: t.id,
          enabled: t.enabled,
          readyState: t.readyState,
          label: t.label,
        })) || [],
        peerUserId,
        socketId: from,
      });
      setAudioWarning(`Could not answer audio connection for ${peer.name || peerUserId}.`);
      setLastWebRTCError(`answer failed: ${err.name} — ${err.message}`);
    }
  }, [channelId, createPeerConnection, flushQueuedIceCandidates, socket]);

  const handleAnswer = useCallback(async ({ from, answer }) => {
    const peerUserId = socketUserMapRef.current.get(from);
    const pc = peerUserId ? peersRef.current.get(peerUserId) : null;
    if (!pc || !answer) return;
    try {
      debugLog('received answer', peerUserId);
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        // Drain any ICE candidates that arrived before the remote description
        await flushQueuedIceCandidates(peerUserId);
      }
    } catch (err) {
      setLastWebRTCError(`set answer failed: ${err.message}`);
      debugLog('set answer failed', err.message);
    }
  }, [flushQueuedIceCandidates]);

  const handleIce = useCallback(async ({ from, candidate }) => {
    const peerUserId = socketUserMapRef.current.get(from);
    const pc = peerUserId ? peersRef.current.get(peerUserId) : null;
    if (!pc || !candidate) return;

    // If we don't have a remote description yet, queue the candidate and
    // it will be drained after setRemoteDescription (handleOffer / handleAnswer).
    if (!pc.remoteDescription) {
      queueIceCandidate(peerUserId, candidate);
      return;
    }

    try {
      debugLog('received ice', peerUserId);
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      if (err.name !== 'InvalidStateError') {
        setLastWebRTCError(`ICE candidate failed: ${err.message}`);
        debugLog('ice failed', err.message);
      }
    }
  }, [queueIceCandidate]);

  const leaveChannel = useCallback(() => {
    cleanupsRef.current.forEach((cleanup) => cleanup());
    cleanupsRef.current = [];
    if (socket?.connected && joinedRef.current) socket.emit('voice:leave', { workspaceId, channelId, userId });
    Array.from(peersRef.current.keys()).forEach(cleanupPeer);
    peersRef.current.clear();
    peerMetaRef.current.clear();
    socketUserMapRef.current.clear();
    dataChannelsRef.current.clear();
    remoteStreamsRef.current.clear();
    setRemoteStreams(new Map());
    setPeerStates(new Map());
    setPeerCount(0);
    pendingIceCandidatesRef.current.clear();
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    joinedRef.current = false;
    joiningRef.current = false;
  }, [channelId, cleanupPeer, socket, userId, workspaceId]);

  const joinChannel = useCallback(async (targetChannelId = channelId, options = {}) => {
    if (!enabled || !socket?.connected || !workspaceId || !targetChannelId || !userId || !localStreamRef.current) return;
    if (joiningRef.current) return;
    if (joinedRef.current && !options.force) return;
    if (joinedRef.current && options.force) leaveChannel();
    joiningRef.current = true;

    const onJoined = ({ peers = [], channelId: joinedChannelId }) => {
      if (joinedChannelId !== targetChannelId) return;
      debugLog('voice joined peers', peers);
      peers.forEach((peer) => {
        socketUserMapRef.current.set(peer.socketId, peer.userId);
        peerMetaRef.current.set(peer.userId, peer);
      });
      peers.forEach(sendOffer);
      joinedRef.current = true;
      joiningRef.current = false;
    };
    const onPeerJoined = ({ peer, channelId: joinedChannelId }) => {
      if (joinedChannelId !== targetChannelId || !peer || peer.userId === userId) return;
      const existingPeer = peerMetaRef.current.get(peer.userId);
      if (existingPeer && existingPeer.socketId !== peer.socketId) cleanupPeer(peer.userId);
      socketUserMapRef.current.set(peer.socketId, peer.userId);
      peerMetaRef.current.set(peer.userId, peer);
      updatePeerState(peer.userId, { ...peer, connected: false, hasAudio: false });
    };
    const onPeerLeft = ({ userId: leftUserId, socketId }) => {
      const peerUserId = leftUserId || socketUserMapRef.current.get(socketId);
      cleanupPeer(peerUserId);
    };
    const onSpeakingState = ({ userId: speakingUserId, socketId, isSpeaking, audioLevel } = {}) => {
      const peerUserId = speakingUserId || socketUserMapRef.current.get(socketId);
      if (!peerUserId || peerUserId === userId) return;
      setPeerStates((prev) => {
        const next = new Map(prev);
        const current = next.get(peerUserId) || {};
        next.set(peerUserId, {
          ...current,
          isSpeaking: current.isMuted ? false : Boolean(isSpeaking),
          audioLevel: current.isMuted ? 0 : Number(audioLevel) || 0,
        });
        return next;
      });
    };
    const onMuteState = ({ userId: mutedUserId, socketId, isMuted: nextMuted } = {}) => {
      const peerUserId = mutedUserId || socketUserMapRef.current.get(socketId);
      if (!peerUserId || peerUserId === userId) return;
      updatePeerState(peerUserId, {
        isMuted: Boolean(nextMuted),
        ...(nextMuted ? { isSpeaking: false, audioLevel: 0 } : {}),
      });
    };

    cleanupsRef.current = [
      () => socket.off('voice:joined', onJoined),
      () => socket.off('voice:peer-joined', onPeerJoined),
      () => socket.off('voice:peer-left', onPeerLeft),
      () => socket.off('speaking-state', onSpeakingState),
      () => socket.off('mute-state', onMuteState),
      () => socket.off('webrtc:offer', handleOffer),
      () => socket.off('webrtc:answer', handleAnswer),
      () => socket.off('webrtc:ice-candidate', handleIce),
    ];
    socket.on('voice:joined', onJoined);
    socket.on('voice:peer-joined', onPeerJoined);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('speaking-state', onSpeakingState);
    socket.on('mute-state', onMuteState);
    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIce);

    debugLog('voice join', { workspaceId, channelId: targetChannelId, userId });
    socket.emit('voice:join', {
      workspaceId,
      channelId: targetChannelId,
      userId,
      userName,
      avatar: userAvatar,
      role: userRole,
      isMuted,
    });
  }, [
    channelId,
    cleanupPeer,
    enabled,
    handleAnswer,
    handleIce,
    handleOffer,
    isMuted,
    leaveChannel,
    sendOffer,
    socket,
    updatePeerState,
    userAvatar,
    userId,
    userName,
    userRole,
    workspaceId,
  ]);

  useEffect(() => {
    if (!enabled || !socket?.connected || !channelId || !localStream) return;
    if (!joinedRef.current) joinChannel(channelId);
  }, [enabled, socket?.connected, channelId, localStream, joinChannel]);

  useEffect(() => {
    if (!enabled || !socket?.connected || !channelId || !localStream || !joinedRef.current) return;
    joinChannel(channelId, { force: true });
    // Intentionally keyed ONLY to socket?.connected — this is a reconnect renegotiation effect.
    // enabled/channelId/localStream are guarded by the early return inside the effect.
    // joinedRef is a ref (stable identity). joinChannel is from a useCallback with stable deps.
    // Adding them would cause duplicate re-joins on unrelated state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket?.connected]);

  useEffect(() => {
    const [audioTrack] = localStream?.getAudioTracks?.() || [];
    const nextTrackId = audioTrack?.id || null;
    if (!nextTrackId || previousLocalTrackIdRef.current === nextTrackId) return;
    previousLocalTrackIdRef.current = nextTrackId;
    replaceLocalTracks(localStream);
  }, [localStream, replaceLocalTracks]);

  const broadcastSpeakingState = useThrottledCallback((nextSpeakingState) => {
    const previous = lastBroadcastSpeakingRef.current;
    const normalized = {
      isSpeaking: Boolean(nextSpeakingState?.isSpeaking),
      audioLevel: Number(nextSpeakingState?.audioLevel) || 0,
    };
    const shouldSend =
      previous.isSpeaking !== normalized.isSpeaking
      || Math.abs(previous.audioLevel - normalized.audioLevel) >= 0.03;

    if (!shouldSend) return;
    lastBroadcastSpeakingRef.current = normalized;
    const msg = JSON.stringify({ type: 'speaking', ...normalized });
    for (const dc of dataChannelsRef.current.values()) {
      if (dc.readyState === 'open') {
        try { dc.send(msg); } catch (e) { /* noop */ }
      }
    }
    if (socket?.connected && channelId && userId) {
      socket.emit('speaking-state', { channelId, userId, ...normalized });
    }
  }, 80);

  useEffect(() => {
    broadcastSpeakingState(speakingState);
  }, [broadcastSpeakingState, speakingState]);

  useEffect(() => {
    const msg = JSON.stringify({ type: 'mute', isMuted });
    for (const dc of dataChannelsRef.current.values()) {
      if (dc.readyState === 'open') {
        try { dc.send(msg); } catch (e) { /* noop */ }
      }
    }
    if (socket?.connected && channelId && userId) socket.emit('mute-state', { channelId, userId, isMuted });
  }, [channelId, isMuted, socket, userId]);

  useEffect(() => () => leaveChannel(), [leaveChannel]);

  return {
    remoteStreams,
    peerStates,
    joinChannel,
    leaveChannel,
    peerCount,
    audioWarning,
    rtcConfiguration,
    turnConfigured: hasTurnServer(rtcConfiguration),
    stunConfigured: hasStunServer(rtcConfiguration),
    lastWebRTCError,
  };
}
