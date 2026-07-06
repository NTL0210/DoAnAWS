const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, AWS_REGION } = process.env;

export async function verifyToken(token) {
  if (!token) {
    throw new AuthError('No token provided', 'AUTH_REQUIRED');
  }
  return verifyCognitoToken(token);
}

async function verifyCognitoToken(token) {
  try {
    if (!COGNITO_USER_POOL_ID) {
      throw new Error('Cognito user pool is not configured');
    }

    const [headerPart, payloadPart] = token.split('.');
    if (!headerPart || !payloadPart) {
      throw new Error('Invalid token format');
    }

    const jwksUrl = `https://cognito-idp.${AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
    const jwks = await fetchWithCache(jwksUrl);

    const header = JSON.parse(Buffer.from(headerPart, 'base64').toString('utf-8'));
    const key = jwks.keys.find((k) => k.kid === header.kid);
    if (!key) {
      throw new Error('No matching JWK key found');
    }

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf-8'));
    const expectedIssuer = `https://cognito-idp.${AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
    if (payload.iss !== expectedIssuer) {
      throw new Error('Invalid issuer');
    }
    if (payload.token_use !== 'access') {
      throw new Error('Invalid token use; expected access token');
    }
    if (COGNITO_CLIENT_ID && payload.client_id !== COGNITO_CLIENT_ID && payload.aud !== COGNITO_CLIENT_ID) {
      throw new Error('Invalid audience');
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    return {
      userId: payload.sub,
      email: payload.email || payload['cognito:email'] || '',
      role: extractRole(payload),
      departmentId: payload['custom:departmentId'] || null,
      workspaceId: payload['custom:workspaceId'] || null,
    };
  } catch (err) {
    throw new AuthError(
      err.message || 'Invalid token',
      'AUTH_INVALID_TOKEN'
    );
  }
}

function extractRole(payload) {
  const role = payload['custom:role'] || payload.role;
  if (['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role)) {
    return role;
  }
  return 'EMPLOYEE';
}

const jwksCache = new Map();
const JWKS_CACHE_TTL = 3600_000;

async function fetchWithCache(url) {
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }
  const data = await response.json();
  jwksCache.set(url, { data, expiresAt: Date.now() + JWKS_CACHE_TTL });
  return data;
}

export class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 401;
    this.code = code;
    this.isOperational = true;
  }
}

export function withAuth(handler, options = {}) {
  return async (event, context) => {
    try {
      const token = extractToken(event);
      const user = await verifyToken(token);

      if (options.roles && options.roles.length > 0 && !options.roles.includes(user.role)) {
        return apiResponse(403, {
          success: false,
          error: 'FORBIDDEN',
          message: 'Insufficient permissions',
        });
      }

      event.authUser = user;
      return await handler(event, context);
    } catch (err) {
      if (err instanceof AuthError) {
        return apiResponse(err.statusCode, {
          success: false,
          error: err.code,
          message: err.message,
        });
      }
      console.error('[withAuth] Unexpected error:', err);
      return apiResponse(500, {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  };
}

function extractToken(event) {
  const authHeader =
    event.headers?.Authorization ||
    event.headers?.authorization ||
    event.auth?.token ||
    '';

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return authHeader || null;
}

export function apiResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

export default { verifyToken, withAuth, AuthError, apiResponse };
