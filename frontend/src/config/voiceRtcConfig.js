/**
 * WebRTC RTCConfiguration for voice channels.
 *
 * STUN — public Google/Twilio servers (always available).
 * TURN — from env vars (prod: fetched via `/api/voice/ice-servers`).
 *
 * `getVoiceRtcConfig()`       → sync config from env (dev / default).
 * `fetchIceServersFromApi()`  → async fetch from backend (production).
 */

const DEBUG = process.env.NODE_ENV === 'development';

// ─── Safe logging helpers ────────────────────────────────────────────────

/**
 * Strip credentials from an RTCConfiguration for safe console logging.
 * @param {import('@/config/voiceRtcConfig').RTCConfiguration} config
 * @returns {Object}
 */
export function getSafeRtcConfigForLog(config) {
  return {
    iceServers: config.iceServers.map((s) => ({
      urls: Array.isArray(s.urls) ? s.urls : [s.urls],
      hasUsername: !!s.username,
      hasCredential: !!s.credential,
    })),
    iceTransportPolicy: config.iceTransportPolicy,
    bundlePolicy: config.bundlePolicy,
    rtcpMuxPolicy: config.rtcpMuxPolicy,
  };
}

// ─── Build RTCConfiguration from env ─────────────────────────────────────

/**
 * Build an RTCConfiguration object from environment variables.
 *
 * Env vars (NEXT_PUBLIC_*):
 *   NEXT_PUBLIC_STUN_URLS     — comma-separated STUN URLs (optional, has defaults)
 *   NEXT_PUBLIC_TURN_URLS     — comma-separated TURN URLs, each may include ?transport=
 *   NEXT_PUBLIC_TURN_USERNAME
 *   NEXT_PUBLIC_TURN_CREDENTIAL
 *   NEXT_PUBLIC_FORCE_TURN    — "true" → iceTransportPolicy: "relay"
 *
 * @returns {RTCConfiguration}
 */
export function getVoiceRtcConfig() {
  // ── STUN (always included) ──────────────────────────────────────────────
  // Multiple servers on different ports for better coverage through various NAT/firewalls
  const defaultStunUrls = [
    // Google STUN (public, widely available)
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun3.l.google.com:19302',
    'stun:stun4.l.google.com:19302',
    // Twilio STUN (fallback port 3478)
    'stun:global.stun.twilio.com:3478',
    // Additional public STUN servers on common ports
    'stun:stun.l.google.com:3478',
    'stun:stun1.l.google.com:3478',
    'stun:stun.services.mozilla.com:3478',
  ];

  const stunUrls = (
    process.env.NEXT_PUBLIC_STUN_URLS ||
    defaultStunUrls.join(',')
  )
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const iceServers = [
    {
      urls: stunUrls,
    },
  ];

  // ── TURN (optional, from env) ──────────────────────────────────────────
  const turnUrlsEnv = process.env.NEXT_PUBLIC_TURN_URLS;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrlsEnv && turnUsername && turnCredential) {
    try {
      const turnUrls = turnUrlsEnv
        .split(',')
        .map((url) => url.trim())
        .filter((url) => {
          const isValid = isValidTurnUrl(url);
          if (!isValid && DEBUG) {
            console.warn('[Voice/ICE] Invalid TURN URL filtered out:', url);
          }
          return isValid;
        });

      if (turnUrls.length > 0) {
        iceServers.push({
          urls: turnUrls,
          username: turnUsername,
          credential: turnCredential,
        });
        if (DEBUG) {
          console.info('[Voice/ICE] Added TURN servers:', turnUrls.length);
        }
      } else if (DEBUG) {
        console.warn('[Voice/ICE] No valid TURN URLs found after filtering');
      }
    } catch (err) {
      if (DEBUG) {
        console.error('[Voice/ICE] Error processing TURN config:', err.message);
      }
    }
  }

  // ── ICE transport policy ──────────────────────────────────────────────
  const forceTurn = process.env.NEXT_PUBLIC_FORCE_TURN === 'true';

  return {
    iceServers,
    iceTransportPolicy: forceTurn ? 'relay' : 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 2,
  };
}

function isValidTurnUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  
  // Check for invalid characters
  if (/[<>\s]/.test(trimmed)) return false;
  
  // Must start with turn: or turns:
  if (!trimmed.startsWith('turn:') && !trimmed.startsWith('turns:')) return false;
  
  // Parse the URL to validate format
  try {
    // More lenient regex that allows various hostname formats
    // turn:hostname:port[?transport=tcp|udp]
    // turns:hostname:port[?transport=tcp|udp]
    const match = trimmed.match(/^turns?:([a-zA-Z0-9.-]+):(\d+)(?:\?transport=(udp|tcp))?$/i);
    if (!match) return false;
    
    const hostname = match[1];
    const port = parseInt(match[2], 10);
    
    // Validate port is in valid range
    if (port < 1 || port > 65535) return false;
    
    // Validate hostname is not empty and contains valid characters
    if (!hostname || hostname.length === 0) return false;
    if (/[/\s<>]/.test(hostname)) return false;
    
    return true;
  } catch {
    return false;
  }
}

// ─── Fetch ICE servers from API (production) ────────────────────────────

/**
 * Fetch ICE servers from the backend API.
 * Falls back to getVoiceRtcConfig() if the API is unreachable.
 *
 * The API endpoint should return short-lived TURN credentials.
 *
 * @returns {Promise<RTCConfiguration>}
 */
export async function fetchIceServersFromApi() {
  try {
    const res = await fetch('/api/voice/ice-servers', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const config = await res.json();
    if (DEBUG) {
      console.info('[Voice/ICE] Fetched ICE servers from API:', getSafeRtcConfigForLog(config));
    }
    return config;
  } catch (err) {
    if (DEBUG) {
      console.warn('[Voice/ICE] API fetch failed, using env config:', err.message);
    }
    return getVoiceRtcConfig();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Check whether an RTCConfiguration includes at least one TURN server.
 * @param {RTCConfiguration} config
 * @returns {boolean}
 */
export function hasTurnServer(config) {
  return config.iceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => String(url).startsWith('turn:') || String(url).startsWith('turns:'));
  });
}

/**
 * Check whether an RTCConfiguration includes at least one STUN server.
 * @param {RTCConfiguration} config
 * @returns {boolean}
 */
export function hasStunServer(config) {
  return config.iceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => String(url).startsWith('stun:') || String(url).startsWith('stuns:'));
  });
}

/**
 * Get selected candidate pair info from a PeerConnection's stats.
 *
 * @param {RTCPeerConnection} pc
 * @returns {Promise<Object|null>}
 */
export async function getSelectedCandidateInfo(pc) {
  try {
    const stats = await pc.getStats();
    /** @type {Map<string,RTCIceCandidateStats>} */
    const localCandidates = new Map();
    /** @type {Map<string,RTCIceCandidateStats>} */
    const remoteCandidates = new Map();
    /** @type {RTCIceCandidatePairStats|undefined} */
    let selectedPair;

    stats.forEach((report) => {
      switch (report.type) {
        case 'local-candidate':
          localCandidates.set(report.id, report);
          break;
        case 'remote-candidate':
          remoteCandidates.set(report.id, report);
          break;
        case 'candidate-pair':
          if ((report.nominated || report.state === 'succeeded') && report.state === 'succeeded') {
            selectedPair = report;
          }
          break;
      }
    });

    if (!selectedPair) {
      // Fallback: try the best-available pair by state
      let bestState = '';
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state !== 'failed') {
          const order = { succeeded: 3, 'in-progress': 2, waiting: 1, frozen: 0 };
          if (order[report.state] > order[bestState]) {
            bestState = report.state;
            selectedPair = report;
          }
        }
      });
    }

    if (!selectedPair) return null;

    const local = localCandidates.get(selectedPair.localCandidateId);
    const remote = remoteCandidates.get(selectedPair.remoteCandidateId);

    // candidateType can be 'host' | 'srflx' | 'prflx' | 'relay'
    return {
      localCandidate: local
        ? {
            type: local.candidateType || 'unknown',
            ip: local.ip || local.address || '?',
            port: local.port,
            protocol: local.protocol || 'udp',
            relayProtocol: local.relayProtocol || null,
            priority: local.priority,
          }
        : null,
      remoteCandidate: remote
        ? {
            type: remote.candidateType || 'unknown',
            ip: remote.ip || remote.address || '?',
            port: remote.port,
            protocol: remote.protocol || 'udp',
          }
        : null,
      currentRoundTripTime: selectedPair.currentRoundTripTime ?? null,
      availableOutgoingBitrate: selectedPair.availableOutgoingBitrate ?? null,
      bytesSent: selectedPair.bytesSent ?? 0,
      bytesReceived: selectedPair.bytesReceived ?? 0,
      requestsSent: selectedPair.requestsSent ?? 0,
      requestsReceived: selectedPair.requestsReceived ?? 0,
      responsesSent: selectedPair.responsesSent ?? 0,
      responsesReceived: selectedPair.responsesReceived ?? 0,
      consentRequestsSent: selectedPair.consentRequestsSent ?? 0,
      packetsDiscardedOnSend: selectedPair.packetsDiscardedOnSend ?? 0,
      state: selectedPair.state,
      nominated: !!selectedPair.nominated,
    };
  } catch {
    return null;
  }
}

/**
 * Determine whether the user is likely behind a symmetric NAT or firewall
 * based on the selected candidate type.
 * @param {string|null} candidateType  'host' | 'srflx' | 'relay' | 'prflx' | null
 * @returns {{ label: string, isRelay: boolean, type: string }}
 */
export function classifyCandidate(candidateType) {
  switch (candidateType) {
    case 'host':
      return { label: 'Host (LAN)', isRelay: false, type: 'host' };
    case 'srflx':
      return { label: 'Server Reflexive (STUN)', isRelay: false, type: 'srflx' };
    case 'prflx':
      return { label: 'Peer Reflexive', isRelay: false, type: 'prflx' };
    case 'relay':
      return { label: 'Relay (TURN)', isRelay: true, type: 'relay' };
    default:
      return { label: candidateType || 'Unknown', isRelay: false, type: candidateType || 'unknown' };
  }
}
