/**
 * Voice Signaling Server - Socket.IO
 *
 * Manages workspace-level voice presence and WebRTC signaling relay.
 */
const { Server } = require('socket.io');
const http = require('http');

const PORT = process.env.VOICE_SIGNALING_PORT || process.env.PORT || 3001;
const DEV_ALLOWED_ORIGINS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/,
];

const httpServer = http.createServer((req, res) => {
  // Health check endpoint for ALB target group
  if (req.url === '/healthz' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }
  // All other HTTP requests return 404
  res.writeHead(404);
  res.end();
});
const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (!origin || DEV_ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
        callback(null, true);
        return;
      }
      callback(null, true);
    },
    methods: ['GET', 'POST'],
  },
  pingInterval: 15000,
  pingTimeout: 20000,
});

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[Signaling] Port ${PORT} is already in use.`);
    console.error('[Signaling] Another voice server is probably already running.');
    console.error(`[Signaling] Stop it first, or start this server with another port: VOICE_SIGNALING_PORT=3002 npm run dev:voice`);
    process.exit(1);
  }
  throw error;
});

// Map<workspaceId, Map<channelId, Map<userId, participant>>>
const workspacePresence = new Map();
// Map<workspaceId, Map<userId, appPresence>>
const workspaceOnlinePresence = new Map();
// Map<socketId, { workspaceId, channelId, userId }>
const socketVoiceState = new Map();
// Map<socketId, { workspaceId, userId }>
const socketWorkspaceState = new Map();
// Map<socketId, userId> — user presence for real-time messaging (invites, etc.)
const socketUserMap = new Map();
// Map<userId, Set<socketId>> — all sockets for a user (multi-tab)
const userSocketsMap = new Map();
// Map<email, userId> — email → userId lookup for invitation routing
const userEmailMap = new Map();

function workspaceRoom(workspaceId) {
  return `workspace:${workspaceId}`;
}

function voiceRoom(channelId) {
  return `voice:${channelId}`;
}

function getWorkspace(workspaceId) {
  if (!workspacePresence.has(workspaceId)) workspacePresence.set(workspaceId, new Map());
  return workspacePresence.get(workspaceId);
}

function getWorkspaceOnline(workspaceId) {
  if (!workspaceOnlinePresence.has(workspaceId)) workspaceOnlinePresence.set(workspaceId, new Map());
  return workspaceOnlinePresence.get(workspaceId);
}

function getChannel(workspaceId, channelId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace.has(channelId)) workspace.set(channelId, new Map());
  return workspace.get(channelId);
}

function serializeChannel(channelMap) {
  return Array.from(channelMap.values());
}

function serializeWorkspace(workspaceId) {
  const workspace = getWorkspace(workspaceId);
  return Object.fromEntries(
    Array.from(workspace.entries()).map(([channelId, participants]) => [
      channelId,
      serializeChannel(participants),
    ])
  );
}

function broadcastPresence(workspaceId, channelId) {
  if (!workspaceId || !channelId) return;
  const participants = serializeChannel(getChannel(workspaceId, channelId));
  io.to(workspaceRoom(workspaceId)).emit('voice:presence:update', {
    workspaceId,
    channelId,
    participants,
  });
}

function serializeOnlineWorkspace(workspaceId) {
  return Array.from(getWorkspaceOnline(workspaceId).values());
}

function broadcastOnlinePresence(workspaceId) {
  if (!workspaceId) return;
  io.to(workspaceRoom(workspaceId)).emit('workspace:presence:update', {
    workspaceId,
    onlineUsers: serializeOnlineWorkspace(workspaceId),
  });
}

// ─── User room helpers (for real-time messaging) ───────────
function userRoom(userId) {
  return `user:${userId}`;
}

function registerUserSocket(socket, userId, email) {
  // Join the user's personal room
  socket.join(userRoom(userId));
  // Track the mapping
  socketUserMap.set(socket.id, userId);
  if (!userSocketsMap.has(userId)) userSocketsMap.set(userId, new Set());
  userSocketsMap.get(userId).add(socket.id);
  // Map email → userId for invitation routing
  if (email) userEmailMap.set(email.toLowerCase(), userId);
}

function unregisterUserSocket(socket) {
  const userId = socketUserMap.get(socket.id);
  if (!userId) return;
  socket.leave(userRoom(userId));
  socketUserMap.delete(socket.id);
  const sockets = userSocketsMap.get(userId);
  if (sockets) {
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      userSocketsMap.delete(userId);
      // Clean up email mapping — no more sockets for this user
      for (const [email, uid] of userEmailMap) {
        if (uid === userId) userEmailMap.delete(email);
      }
    }
  }
}

function removeSocketFromWorkspace(socket, reason = 'left') {
  const state = socketWorkspaceState.get(socket.id);
  if (!state) return;
  const { workspaceId, userId } = state;
  const online = getWorkspaceOnline(workspaceId);
  const current = online.get(userId);
  if (current?.socketId === socket.id) {
    online.delete(userId);
    broadcastOnlinePresence(workspaceId);
  }
  socketWorkspaceState.delete(socket.id);
  socket.leave(workspaceRoom(workspaceId));
}

function removeSocketFromVoice(socket, reason = 'left') {
  const state = socketVoiceState.get(socket.id);
  if (!state) return;
  const { workspaceId, channelId, userId } = state;
  const channel = getChannel(workspaceId, channelId);
  const participant = channel.get(userId);

  if (participant?.socketId === socket.id) {
    channel.delete(userId);
  }
  socket.leave(voiceRoom(channelId));
  socketVoiceState.delete(socket.id);

  socket.to(voiceRoom(channelId)).emit('voice:peer-left', {
    workspaceId,
    channelId,
    userId,
    socketId: socket.id,
    reason,
  });
  socket.to(voiceRoom(channelId)).emit('user-left', { socketId: socket.id, userId });
  broadcastPresence(workspaceId, channelId);
}

function upsertParticipant(socket, payload) {
  const {
    workspaceId,
    channelId,
    userId,
    userName,
    name,
    avatar,
    role,
    userInfo = {},
    isMuted = false,
  } = payload || {};

  if (!workspaceId || !channelId || !userId) return null;
  removeSocketFromVoice(socket, 'switch');

  const participant = {
    socketId: socket.id,
    userId,
    name: userName || name || userInfo.name || 'Unknown',
    avatar: avatar || userInfo.avatar || null,
    role: role || userInfo.role || 'Member',
    isMuted: Boolean(isMuted),
    isSpeaking: false,
    audioLevel: 0,
    joinedAt: new Date().toISOString(),
    connected: true,
  };

  const channel = getChannel(workspaceId, channelId);
  const existingPeers = serializeChannel(channel).filter((peer) => peer.userId !== userId);
  channel.set(userId, participant);

  socket.join(workspaceRoom(workspaceId));
  socket.join(voiceRoom(channelId));
  socketVoiceState.set(socket.id, { workspaceId, channelId, userId });

  socket.emit('voice:joined', { workspaceId, channelId, peers: existingPeers });
  socket.emit('existing-users', {
    channelId,
    users: existingPeers.map((peer) => ({
      socketId: peer.socketId,
      userId: peer.userId,
      userInfo: { name: peer.name, avatar: peer.avatar, role: peer.role },
      isMuted: peer.isMuted,
    })),
  });

  socket.to(voiceRoom(channelId)).emit('voice:peer-joined', { workspaceId, channelId, peer: participant });
  socket.to(voiceRoom(channelId)).emit('user-joined', {
    socketId: socket.id,
    userId,
    userInfo: { name: participant.name, avatar: participant.avatar, role: participant.role },
    isMuted: participant.isMuted,
  });
  broadcastPresence(workspaceId, channelId);
  console.log(`[Signaling] ${userId} joined ${channelId} in ${workspaceId}`);
  return participant;
}

io.on('connection', (socket) => {
  console.log(`[Signaling] Client connected: ${socket.id}`);

  socket.on('voice-ping', ({ timestamp } = {}) => {
    socket.emit('voice-pong', { timestamp });
  });

  socket.on('workspace:join', ({ workspaceId, user } = {}) => {
    if (!workspaceId) return;
    if (user?.id) {
      removeSocketFromWorkspace(socket, 'switch');
      const online = getWorkspaceOnline(workspaceId);
      const presence = {
        socketId: socket.id,
        userId: user.id,
        name: user.name || 'Unknown',
        avatar: user.avatar || null,
        role: user.role || user.workspaceRole || 'Member',
        online: true,
        connectedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      online.set(user.id, presence);
      socketWorkspaceState.set(socket.id, { workspaceId, userId: user.id });
    }
    socket.join(workspaceRoom(workspaceId));
    socket.emit('voice:presence:snapshot', {
      workspaceId,
      participantsByChannel: serializeWorkspace(workspaceId),
    });
    socket.emit('workspace:presence:snapshot', {
      workspaceId,
      onlineUsers: serializeOnlineWorkspace(workspaceId),
    });
    if (user?.id) broadcastOnlinePresence(workspaceId);
  });

  socket.on('workspace:presence:get', ({ workspaceId } = {}) => {
    if (!workspaceId) return;
    socket.emit('workspace:presence:snapshot', {
      workspaceId,
      onlineUsers: serializeOnlineWorkspace(workspaceId),
    });
  });

  socket.on('voice:presence:get', ({ workspaceId } = {}) => {
    if (!workspaceId) return;
    socket.emit('voice:presence:snapshot', {
      workspaceId,
      participantsByChannel: serializeWorkspace(workspaceId),
    });
  });

  // ─── User presence (for real-time messaging) ───────────
  socket.on('user:online', ({ userId, email } = {}) => {
    if (!userId) return;
    registerUserSocket(socket, userId, email);
  });

  /**
   * Relay an invitation to a specific user in real time.
   * Payload: {
   *   toUserId?: string,       // recipient's user ID (optional if inviteeEmail provided)
   *   inviteeEmail?: string,   // recipient's email (used to look up userId)
   *   invitation: object       // full invitation object
   * }
   * The signaling server forwards `invitation:new` to all of the
   * recipient's connected sockets (multi-tab support).
   */
  socket.on('invitation:send', ({ toUserId, inviteeEmail, invitation } = {}) => {
    if (!invitation) return;
    // Resolve target: use toUserId directly, or look up from email mapping
    const targetId = toUserId || (inviteeEmail && userEmailMap.get(inviteeEmail.toLowerCase()));
    if (!targetId) {
      console.log(`[Signaling] Invitation relay skipped — ${inviteeEmail || 'unknown'} is offline`);
      return;
    }
    const senderId = socketUserMap.get(socket.id);
    console.log(`[Signaling] Invitation relay: ${senderId} → ${targetId}`);
    io.to(userRoom(targetId)).emit('invitation:new', invitation);
  });

  /**
   * Notify the sender that their invitation was accepted.
   * Payload: {
   *   fromUserId: string,      // original invitee's user ID
   *   invitation: object       // the accepted invitation
   * }
   */
  socket.on('invitation:accept', ({ fromUserId, invitation } = {}) => {
    if (!fromUserId || !invitation) return;
    console.log(`[Signaling] Invitation accepted: ${fromUserId} accepted invite to ${invitation.workspaceName}`);
    // Notify the original sender (the one who created the invitation)
    if (invitation.invitedByUserId) {
      io.to(userRoom(invitation.invitedByUserId)).emit('invitation:accepted', {
        invitation,
        acceptedBy: fromUserId,
      });
    }
  });

  socket.on('voice:join', (payload = {}) => upsertParticipant(socket, payload));

  socket.on('join-room', (payload = {}) => {
    upsertParticipant(socket, {
      ...payload,
      workspaceId: payload.workspaceId || 'default',
      userName: payload.userInfo?.name,
      avatar: payload.userInfo?.avatar,
      role: payload.userInfo?.role,
    });
  });

  socket.on('voice:leave', () => removeSocketFromVoice(socket));

  socket.on('leave-room', () => removeSocketFromVoice(socket));

  socket.on('webrtc:offer', ({ to, from, channelId, offer } = {}) => {
    if (!to || !offer) return;
    io.to(to).emit('webrtc:offer', { from: from || socket.id, channelId, offer });
  });

  socket.on('webrtc:answer', ({ to, from, channelId, answer } = {}) => {
    if (!to || !answer) return;
    io.to(to).emit('webrtc:answer', { from: from || socket.id, channelId, answer });
  });

  socket.on('webrtc:ice-candidate', ({ to, from, channelId, candidate } = {}) => {
    if (!to || !candidate) return;
    io.to(to).emit('webrtc:ice-candidate', { from: from || socket.id, channelId, candidate });
  });

  socket.on('peer-signal', ({ targetSocketId, signal, channelId } = {}) => {
    if (!targetSocketId || !signal) return;
    io.to(targetSocketId).emit('peer-signal', { socketId: socket.id, signal, channelId });
  });

  socket.on('mute-state', ({ channelId, userId, isMuted } = {}) => {
    const state = socketVoiceState.get(socket.id);
    const workspaceId = state?.workspaceId;
    if (workspaceId && channelId && userId) {
      const participant = getChannel(workspaceId, channelId).get(userId);
      if (participant) participant.isMuted = Boolean(isMuted);
      broadcastPresence(workspaceId, channelId);
    }
    socket.to(voiceRoom(channelId)).emit('mute-state', { socketId: socket.id, userId, isMuted });
  });

  socket.on('speaking-state', ({ channelId, userId, isSpeaking, audioLevel } = {}) => {
    const state = socketVoiceState.get(socket.id);
    const workspaceId = state?.workspaceId;
    if (workspaceId && channelId && userId) {
      const participant = getChannel(workspaceId, channelId).get(userId);
      if (participant) {
        participant.isSpeaking = participant.isMuted ? false : Boolean(isSpeaking);
        participant.audioLevel = participant.isMuted ? 0 : Number(audioLevel) || 0;
      }
    }
    socket.to(voiceRoom(channelId)).emit('speaking-state', {
      socketId: socket.id,
      userId,
      isSpeaking,
      audioLevel,
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Signaling] Client disconnected: ${socket.id} (${reason})`);
    removeSocketFromVoice(socket, reason);
    removeSocketFromWorkspace(socket, reason);
    unregisterUserSocket(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Signaling] Voice signaling server running on port ${PORT}`);
});
