/**
 * GET /api/voice/ice-servers
 *
 * Returns TURN/STUN server configuration for WebRTC voice.
 *
 * In production, this endpoint should return short-lived TURN credentials
 * (e.g. using HMAC-based TURN REST API). For development, it reads from
 * environment variables.
 *
 * Response shape:
 *   {
 *     iceServers: [
 *       { urls: ["stun:..."] },
 *       { urls: ["turn:..."], username: "...", credential: "..." }
 *     ],
 *     iceTransportPolicy: "all" | "relay"
 *   }
 */

export default function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // ── STUN servers (always provided) ───────────────────────────────
  const stunUrls = (
    process.env.NEXT_PUBLIC_STUN_URLS ||
    'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:global.stun.twilio.com:3478'
  )
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const iceServers = [
    { urls: stunUrls },
  ];

  // ── TURN servers (from server-side env only — NOT NEXT_PUBLIC_) ──
  // In production, the server-side TURN_URLS is not exposed to the client bundle.
  const turnUrls = process.env.TURN_URLS || process.env.NEXT_PUBLIC_TURN_URLS;
  const turnUsername = process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrls && turnUsername && turnCredential) {
    const urls = turnUrls
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length > 0) {
      iceServers.push({
        urls,
        username: turnUsername,
        credential: turnCredential,
      });
    }
  }

  const forceTurn = (process.env.FORCE_TURN || process.env.NEXT_PUBLIC_FORCE_TURN) === 'true';

  res.status(200).json({
    iceServers,
    iceTransportPolicy: forceTurn ? 'relay' : 'all',
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require',
  });
}
