/**
 * Voice Signaling Server - Socket.IO
 *
 * Manages workspace-level voice presence and WebRTC signaling relay.
 */
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.VOICE_SIGNALING_PORT || process.env.PORT || 3001;
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';
const PRESENCE_TTL_MS = 60_000;
const VOICE_TTL_MS = 90_000;
const JWKS_CACHE_TTL_MS = 3_600_000;
const DEV_ALLOWED_ORIGINS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/,
];
const DEFAULT_PRODUCTION_ORIGINS = [
  'https://d1gdsnv8exdah.cloudfront.net',
];

function getAllowedOrigins() {
  const configured = process.env.VOICE_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || '';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(origins.length ? origins : DEFAULT_PRODUCTION_ORIGINS);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (getAllowedOrigins().has(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    return DEV_ALLOWED_ORIGINS.some((pattern) => pattern.test(origin));
  }
  return false;
}

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
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by voice signaling CORS'));
    },
    methods: ['GET', 'POST'],
  },
  allowRequest(req, callback) {
    const origin = req.headers.origin;
    callback(null, isAllowedOrigin(origin));
  },
  maxHttpBufferSize: 100_000,
  pingInterval: 15000,
  pingTimeout: 20000,
});

const jwksCache = new Map();

function shouldRequireSocketAuth() {
  return process.env.REQUIRE_SIGNALING_AUTH === 'true'
    || Boolean(process.env.COGNITO_USER_POOL_ID);
}

function base64UrlJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function fetchJwks(userPoolId) {
  const cached = jwksCache.get(userPoolId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const url = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch Cognito JWKS: ${response.status}`);
  const data = await response.json();
  jwksCache.set(userPoolId, { data, expiresAt: Date.now() + JWKS_CACHE_TTL_MS });
  return data;
}

async function verifyCognitoToken(token) {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) throw new Error('COGNITO_USER_POOL_ID is not configured');
  const [headerPart, payloadPart, signaturePart] = String(token || '').split('.');
  if (!headerPart || !payloadPart || !signaturePart) throw new Error('Invalid token format');

  const header = base64UrlJson(headerPart);
  const payload = base64UrlJson(payloadPart);
  if (header.alg !== 'RS256') throw new Error('Unsupported token algorithm');

  const jwks = await fetchJwks(userPoolId);
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('No matching Cognito key');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerPart}.${payloadPart}`);
  verifier.end();
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signature = Buffer.from(signaturePart, 'base64url');
  if (!verifier.verify(publicKey, signature)) throw new Error('Invalid token signature');

  const expectedIssuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${userPoolId}`;
  if (payload.iss !== expectedIssuer) throw new Error('Invalid token issuer');
  if (Number(payload.exp || 0) * 1000 < Date.now()) throw new Error('Token expired');
  if (payload.token_use !== 'access' && payload.token_use !== 'id') throw new Error('Invalid token use');

  const clientId = process.env.COGNITO_CLIENT_ID;
  const tokenClientId = payload.token_use === 'id' ? payload.aud : payload.client_id;
  if (clientId && tokenClientId !== clientId) throw new Error('Invalid token audience');

  return {
    userId: String(payload.sub || ''),
    email: String(payload.email || payload['cognito:email'] || ''),
    name: String(payload.name || payload.preferred_username || payload.username || payload['cognito:username'] || ''),
  };
}

io.use(async (socket, next) => {
  if (!shouldRequireSocketAuth()) {
    console.warn('[Signaling] Cognito auth env is not set; accepting socket without JWT verification.');
    next();
    return;
  }

  try {
    const token = socket.handshake.auth?.token;
    const authUser = await verifyCognitoToken(token);
    if (!authUser.userId) throw new Error('Token missing user id');
    socket.authUser = authUser;
    next();
  } catch (error) {
    next(new Error('Authentication required'));
  }
});

let redisClient = null;
let redisSubClient = null;
let redisReady = false;

async function setupRedisAdapter() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Signaling] REDIS_URL not set; using single-instance in-memory signaling.');
    return;
  }

  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (error) => console.error('[Signaling] Redis pub error:', error.message));
    subClient.on('error', (error) => console.error('[Signaling] Redis sub error:', error.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    redisClient = pubClient;
    redisSubClient = subClient;
    redisReady = true;
    console.log('[Signaling] Redis adapter enabled for multi-EC2 realtime.');
  } catch (error) {
    redisClient = null;
    redisSubClient = null;
    redisReady = false;
    console.error('[Signaling] Redis adapter failed; falling back to in-memory signaling:', error.message);
  }
}

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
// Map<socketId, { workspaceId, userId, presence }>
const socketWorkspaceState = new Map();
// Map<socketId, userId> — user presence for real-time messaging (invites, etc.)
const socketUserMap = new Map();
// Map<userId, Set<socketId>> — all sockets for a user (multi-tab)
const userSocketsMap = new Map();
// Map<email, userId> — email → userId lookup for invitation routing
const userEmailMap = new Map();

function displayNameFromEmail(email) {
  return typeof email === 'string' && email.includes('@') ? email.split('@')[0] : '';
}

function authUserId(socket) {
  return socket.authUser?.userId || null;
}

function matchesAuthenticatedUser(socket, userId) {
  const authenticatedUserId = authUserId(socket);
  return !authenticatedUserId || authenticatedUserId === userId;
}

function canRelayVoiceSignal(socket, targetSocketId, channelId) {
  const sourceState = socketVoiceState.get(socket.id);
  const targetState = socketVoiceState.get(targetSocketId);
  if (!sourceState || !targetState) return false;
  if (sourceState.workspaceId !== targetState.workspaceId) return false;
  if (sourceState.channelId !== targetState.channelId) return false;
  return !channelId || sourceState.channelId === channelId;
}

function workspaceRoom(workspaceId) {
  return `workspace:${workspaceId}`;
}

function voiceRoom(channelId) {
  return `voice:${channelId}`;
}

function workspacePresenceKey(workspaceId) {
  return `presence:workspace:${workspaceId}`;
}

function voicePresenceKey(workspaceId, channelId) {
  return `presence:voice:${workspaceId}:${channelId}`;
}

function voiceChannelsKey(workspaceId) {
  return `presence:voice-channels:${workspaceId}`;
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

function serializeLocalChannel(channelMap) {
  return Array.from(channelMap.values());
}

function serializeLocalWorkspace(workspaceId) {
  const workspace = getWorkspace(workspaceId);
  return Object.fromEntries(
    Array.from(workspace.entries()).map(([channelId, participants]) => [
      channelId,
      serializeLocalChannel(participants),
    ])
  );
}

async function readJsonHash(key, ttlMs) {
  if (!redisReady || !redisClient) return [];
  const raw = await redisClient.hGetAll(key);
  const now = Date.now();
  const values = [];
  const staleFields = [];

  for (const [field, json] of Object.entries(raw || {})) {
    try {
      const value = JSON.parse(json);
      const seenAt = Date.parse(value.lastSeenAt || value.updatedAt || value.joinedAt || value.connectedAt || 0);
      if (ttlMs && (!seenAt || Number.isNaN(seenAt) || now - seenAt > ttlMs)) {
        staleFields.push(field);
      } else {
        values.push(value);
      }
    } catch {
      staleFields.push(field);
    }
  }

  if (staleFields.length) await redisClient.hDel(key, staleFields);
  return values;
}

async function writeJsonHash(key, field, value) {
  if (!redisReady || !redisClient) return;
  await redisClient.hSet(key, field, JSON.stringify(value));
  await redisClient.expire(key, 3600);
}

async function deleteJsonHash(key, field) {
  if (!redisReady || !redisClient) return;
  await redisClient.hDel(key, field);
}

async function serializeChannelPresence(workspaceId, channelId) {
  if (redisReady) return readJsonHash(voicePresenceKey(workspaceId, channelId), VOICE_TTL_MS);
  return serializeLocalChannel(getChannel(workspaceId, channelId));
}

async function serializeWorkspace(workspaceId) {
  if (!redisReady || !redisClient) return serializeLocalWorkspace(workspaceId);
  const channels = await redisClient.sMembers(voiceChannelsKey(workspaceId));
  const entries = await Promise.all(
    channels.map(async (channelId) => [channelId, await serializeChannelPresence(workspaceId, channelId)])
  );
  return Object.fromEntries(entries.filter(([, participants]) => participants.length > 0));
}

async function broadcastPresence(workspaceId, channelId) {
  if (!workspaceId || !channelId) return;
  const participants = await serializeChannelPresence(workspaceId, channelId);
  io.to(workspaceRoom(workspaceId)).emit('voice:presence:update', {
    workspaceId,
    channelId,
    participants,
  });
}

async function serializeOnlineWorkspace(workspaceId) {
  if (redisReady) return readJsonHash(workspacePresenceKey(workspaceId), PRESENCE_TTL_MS);
  return Array.from(getWorkspaceOnline(workspaceId).values());
}

async function broadcastOnlinePresence(workspaceId) {
  if (!workspaceId) return;
  io.to(workspaceRoom(workspaceId)).emit('workspace:presence:update', {
    workspaceId,
    onlineUsers: await serializeOnlineWorkspace(workspaceId),
  });
}

function findWorkspaceSocketForUser(workspaceId, userId, exceptSocketId) {
  for (const [socketId, state] of socketWorkspaceState.entries()) {
    if (
      socketId !== exceptSocketId
      && state.workspaceId === workspaceId
      && state.userId === userId
    ) {
      return socketId;
    }
  }
  return null;
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

async function removeSocketFromWorkspace(socket, reason = 'left') {
  const state = socketWorkspaceState.get(socket.id);
  if (!state) return;
  const { workspaceId, userId } = state;
  const online = getWorkspaceOnline(workspaceId);
  const current = online.get(userId);
  if (current?.socketId === socket.id) {
    const replacementSocketId = findWorkspaceSocketForUser(workspaceId, userId, socket.id);
    if (replacementSocketId) {
      const replacementPresence = {
        ...current,
        socketId: replacementSocketId,
        online: true,
        lastSeenAt: new Date().toISOString(),
      };
      online.set(userId, replacementPresence);
      await writeJsonHash(workspacePresenceKey(workspaceId), userId, replacementPresence);
    } else {
      online.delete(userId);
      if (redisReady) {
        const currentRemote = (await readJsonHash(workspacePresenceKey(workspaceId), 0))
          .find((item) => item.userId === userId);
        if (!currentRemote || currentRemote.socketId === socket.id) {
          await deleteJsonHash(workspacePresenceKey(workspaceId), userId);
        }
      }
    }
    await broadcastOnlinePresence(workspaceId);
  }
  socketWorkspaceState.delete(socket.id);
  socket.leave(workspaceRoom(workspaceId));
}

async function removeSocketFromVoice(socket, reason = 'left') {
  const state = socketVoiceState.get(socket.id);
  if (!state) return;
  const { workspaceId, channelId, userId } = state;
  const channel = getChannel(workspaceId, channelId);
  const participant = channel.get(userId);

  if (participant?.socketId === socket.id) {
    channel.delete(userId);
  }
  if (redisReady) {
    const current = (await readJsonHash(voicePresenceKey(workspaceId, channelId), 0))
      .find((item) => item.userId === userId);
    if (!current || current.socketId === socket.id) {
      await deleteJsonHash(voicePresenceKey(workspaceId, channelId), userId);
    }
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
  await broadcastPresence(workspaceId, channelId);
}

async function upsertParticipant(socket, payload) {
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
  if (!matchesAuthenticatedUser(socket, userId)) return null;
  await removeSocketFromVoice(socket, 'switch');

  const now = new Date().toISOString();
  const participant = {
    socketId: socket.id,
    userId,
    name: userName || name || userInfo.name || displayNameFromEmail(userInfo.email) || 'Member',
    avatar: avatar || userInfo.avatar || null,
    role: role || userInfo.role || 'Member',
    isMuted: Boolean(isMuted),
    isSpeaking: false,
    audioLevel: 0,
    joinedAt: now,
    lastSeenAt: now,
    connected: true,
  };

  const channel = getChannel(workspaceId, channelId);
  const existingPeers = (await serializeChannelPresence(workspaceId, channelId))
    .filter((peer) => peer.userId !== userId);
  channel.set(userId, participant);
  if (redisReady && redisClient) {
    await writeJsonHash(voicePresenceKey(workspaceId, channelId), userId, participant);
    await redisClient.sAdd(voiceChannelsKey(workspaceId), channelId);
    await redisClient.expire(voiceChannelsKey(workspaceId), 3600);
  }

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
  await broadcastPresence(workspaceId, channelId);
  console.log(`[Signaling] ${userId} joined ${channelId} in ${workspaceId}`);
  return participant;
}

io.on('connection', (socket) => {
  console.log(`[Signaling] Client connected: ${socket.id}`);

  socket.on('voice-ping', async ({ timestamp } = {}) => {
    const state = socketVoiceState.get(socket.id);
    if (state?.workspaceId && state.channelId && state.userId) {
      const participant = getChannel(state.workspaceId, state.channelId).get(state.userId);
      if (participant) {
        participant.lastSeenAt = new Date().toISOString();
        await writeJsonHash(voicePresenceKey(state.workspaceId, state.channelId), state.userId, participant);
      }
    }
    socket.emit('voice-pong', { timestamp });
  });

  socket.on('workspace:join', async ({ workspaceId, user } = {}) => {
    if (!workspaceId) return;
    if (user?.id) {
      if (!matchesAuthenticatedUser(socket, user.id)) return;
      const previous = socketWorkspaceState.get(socket.id);
      if (previous && (previous.workspaceId !== workspaceId || previous.userId !== user.id)) {
        await removeSocketFromWorkspace(socket, 'switch');
      }
      const online = getWorkspaceOnline(workspaceId);
      const presence = {
        socketId: socket.id,
        userId: user.id,
        name: user.name || displayNameFromEmail(user.email) || 'Member',
        email: user.email || '',
        avatar: user.avatar || null,
        role: user.workspaceRole || user.role || 'Member',
        online: true,
        connectedAt: previous?.presence?.connectedAt || new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      online.set(user.id, presence);
      await writeJsonHash(workspacePresenceKey(workspaceId), user.id, presence);
      socketWorkspaceState.set(socket.id, { workspaceId, userId: user.id, presence });
    }
    socket.join(workspaceRoom(workspaceId));
    socket.emit('voice:presence:snapshot', {
      workspaceId,
      participantsByChannel: await serializeWorkspace(workspaceId),
    });
    socket.emit('workspace:presence:snapshot', {
      workspaceId,
      onlineUsers: await serializeOnlineWorkspace(workspaceId),
    });
    if (user?.id) await broadcastOnlinePresence(workspaceId);
  });

  socket.on('workspace:presence:get', async ({ workspaceId } = {}) => {
    if (!workspaceId) return;
    const state = socketWorkspaceState.get(socket.id);
    if (state?.workspaceId !== workspaceId) return;
    socket.emit('workspace:presence:snapshot', {
      workspaceId,
      onlineUsers: await serializeOnlineWorkspace(workspaceId),
    });
  });

  socket.on('workspace:presence:heartbeat', async ({ workspaceId, userId, user } = {}) => {
    if (!workspaceId || !userId) return;
    if (!matchesAuthenticatedUser(socket, userId)) return;
    const state = socketWorkspaceState.get(socket.id);
    if (state?.workspaceId !== workspaceId || state.userId !== userId) return;
    const online = getWorkspaceOnline(workspaceId);
    const current = online.get(userId);
    if (current) {
      current.lastSeenAt = new Date().toISOString();
      current.online = true;
      await writeJsonHash(workspacePresenceKey(workspaceId), userId, current);
      return;
    }
    if (state?.workspaceId === workspaceId && state.userId === userId) {
      const presence = {
        ...(state.presence || {}),
        socketId: socket.id,
        userId,
        name: user?.name || state.presence?.name || displayNameFromEmail(user?.email) || 'Member',
        email: user?.email || state.presence?.email || '',
        avatar: user?.avatar || state.presence?.avatar || null,
        role: user?.workspaceRole || user?.role || state.presence?.role || 'Member',
        online: true,
        connectedAt: state.presence?.connectedAt || new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      online.set(userId, presence);
      socketWorkspaceState.set(socket.id, { workspaceId, userId, presence });
      await writeJsonHash(workspacePresenceKey(workspaceId), userId, presence);
      await broadcastOnlinePresence(workspaceId);
    }
  });

  socket.on('workspace:event', ({ workspaceId, type, payload } = {}) => {
    if (!workspaceId || !type) return;
    const state = socketWorkspaceState.get(socket.id);
    if (state?.workspaceId !== workspaceId) return;
    socket.to(workspaceRoom(workspaceId)).emit('workspace:event', {
      workspaceId,
      type,
      payload: payload || null,
      emittedAt: new Date().toISOString(),
    });
  });

  socket.on('voice:presence:get', async ({ workspaceId } = {}) => {
    if (!workspaceId) return;
    const state = socketWorkspaceState.get(socket.id);
    if (state?.workspaceId !== workspaceId) return;
    socket.emit('voice:presence:snapshot', {
      workspaceId,
      participantsByChannel: await serializeWorkspace(workspaceId),
    });
  });

  // ─── User presence (for real-time messaging) ───────────
  socket.on('user:online', ({ userId, email } = {}) => {
    if (!userId) return;
    if (!matchesAuthenticatedUser(socket, userId)) return;
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
    if (!senderId || (invitation.invitedByUserId && invitation.invitedByUserId !== senderId)) return;
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
    if (!matchesAuthenticatedUser(socket, fromUserId)) return;
    console.log(`[Signaling] Invitation accepted: ${fromUserId} accepted invite to ${invitation.workspaceName}`);
    // Notify the original sender (the one who created the invitation)
    if (invitation.invitedByUserId) {
      io.to(userRoom(invitation.invitedByUserId)).emit('invitation:accepted', {
        invitation,
        acceptedBy: fromUserId,
      });
    }
  });

  socket.on('voice:join', async (payload = {}) => {
    await upsertParticipant(socket, payload);
  });

  socket.on('join-room', async (payload = {}) => {
    await upsertParticipant(socket, {
      ...payload,
      workspaceId: payload.workspaceId || 'default',
      userName: payload.userInfo?.name,
      avatar: payload.userInfo?.avatar,
      role: payload.userInfo?.role,
    });
  });

  socket.on('voice:leave', async () => removeSocketFromVoice(socket));

  socket.on('leave-room', async () => removeSocketFromVoice(socket));

  socket.on('webrtc:offer', ({ to, from, channelId, offer } = {}) => {
    if (!to || !offer) return;
    if (!canRelayVoiceSignal(socket, to, channelId)) return;
    io.to(to).emit('webrtc:offer', {
      from: from || socket.id,
      fromUserId: socketVoiceState.get(socket.id)?.userId || socketUserMap.get(socket.id) || null,
      channelId,
      offer,
    });
  });

  socket.on('webrtc:answer', ({ to, from, channelId, answer } = {}) => {
    if (!to || !answer) return;
    if (!canRelayVoiceSignal(socket, to, channelId)) return;
    io.to(to).emit('webrtc:answer', {
      from: from || socket.id,
      fromUserId: socketVoiceState.get(socket.id)?.userId || socketUserMap.get(socket.id) || null,
      channelId,
      answer,
    });
  });

  socket.on('webrtc:ice-candidate', ({ to, from, channelId, candidate } = {}) => {
    if (!to || !candidate) return;
    if (!canRelayVoiceSignal(socket, to, channelId)) return;
    io.to(to).emit('webrtc:ice-candidate', {
      from: from || socket.id,
      fromUserId: socketVoiceState.get(socket.id)?.userId || socketUserMap.get(socket.id) || null,
      channelId,
      candidate,
    });
  });

  socket.on('peer-signal', ({ targetSocketId, signal, channelId } = {}) => {
    if (!targetSocketId || !signal) return;
    if (!canRelayVoiceSignal(socket, targetSocketId, channelId)) return;
    io.to(targetSocketId).emit('peer-signal', { socketId: socket.id, signal, channelId });
  });

  socket.on('mute-state', async ({ channelId, userId, isMuted } = {}) => {
    const state = socketVoiceState.get(socket.id);
    const workspaceId = state?.workspaceId;
    if (!state || state.channelId !== channelId || state.userId !== userId) return;
    if (workspaceId && channelId && userId) {
      const participant = getChannel(workspaceId, channelId).get(userId);
      if (participant) {
        participant.isMuted = Boolean(isMuted);
        participant.lastSeenAt = new Date().toISOString();
        await writeJsonHash(voicePresenceKey(workspaceId, channelId), userId, participant);
      }
      await broadcastPresence(workspaceId, channelId);
    }
    socket.to(voiceRoom(channelId)).emit('mute-state', { socketId: socket.id, userId, isMuted });
  });

  socket.on('speaking-state', async ({ channelId, userId, isSpeaking, audioLevel } = {}) => {
    const state = socketVoiceState.get(socket.id);
    const workspaceId = state?.workspaceId;
    if (!state || state.channelId !== channelId || state.userId !== userId) return;
    if (workspaceId && channelId && userId) {
      const participant = getChannel(workspaceId, channelId).get(userId);
      if (participant) {
        participant.isSpeaking = participant.isMuted ? false : Boolean(isSpeaking);
        participant.audioLevel = participant.isMuted ? 0 : Number(audioLevel) || 0;
        participant.lastSeenAt = new Date().toISOString();
        await writeJsonHash(voicePresenceKey(workspaceId, channelId), userId, participant);
      }
    }
    socket.to(voiceRoom(channelId)).emit('speaking-state', {
      socketId: socket.id,
      userId,
      isSpeaking,
      audioLevel,
    });
  });

  socket.on('disconnect', async (reason) => {
    console.log(`[Signaling] Client disconnected: ${socket.id} (${reason})`);
    await removeSocketFromVoice(socket, reason);
    await removeSocketFromWorkspace(socket, reason);
    unregisterUserSocket(socket);
  });
});

setInterval(async () => {
  const cutoff = Date.now() - 45000;
  for (const [workspaceId, online] of workspaceOnlinePresence.entries()) {
    let changed = false;
    for (const [userId, presence] of online.entries()) {
      const lastSeen = Date.parse(presence.lastSeenAt || presence.connectedAt || 0);
      const socketStillKnown = presence.socketId && socketWorkspaceState.has(presence.socketId);
      if (!socketStillKnown || Number.isNaN(lastSeen) || lastSeen < cutoff) {
        const replacementSocketId = findWorkspaceSocketForUser(workspaceId, userId, presence.socketId);
        if (replacementSocketId) {
          online.set(userId, { ...presence, socketId: replacementSocketId, lastSeenAt: new Date().toISOString() });
        } else {
          online.delete(userId);
        }
        changed = true;
      }
    }
    if (changed) await broadcastOnlinePresence(workspaceId);
  }
}, 15000).unref?.();

setupRedisAdapter()
  .finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`[Signaling] Voice signaling server running on port ${PORT}`);
    });
  });
