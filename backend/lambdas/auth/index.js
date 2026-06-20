/**
 * Auth Lambda — Login & user session
 *
 * Routes:
 *   POST /auth/login — Authenticate user (no auth required)
 *   GET  /auth/me    — Get current user session (auth required)
 *
 * This Lambda uses Cognito for production auth,
 * or mock user lookup for development.
 *
 * @module lambdas/auth/index
 */

import { createHash } from 'node:crypto';
import { withAuth, apiResponse } from '../shared/cognitoAuth.js';
import { success, notFound, badRequest } from '../shared/router.js';
import * as userRepo from '../../src/dynamodb/repositories/userRepository.js';

const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, ENVIRONMENT } = process.env;
const IS_MOCK = ENVIRONMENT === 'development' || !COGNITO_USER_POOL_ID;

// ─── Login Handler ────────────────────────────────────

/**
 * POST /auth/login
 *
 * In production: delegates to Cognito's USER_PASSWORD_AUTH flow.
 * In development: mock auth with local user lookup.
 */
export async function login(event) {
  const { email, password } = event.parsedBody || {};

  if (!email || !password) {
    return badRequest('Email and password are required');
  }

  if (IS_MOCK) {
    return mockLogin(email, password);
  }

  return cognitoLogin(email, password);
}

/**
 * Mock login — validates against local user repository.
 */
async function mockLogin(email, password) {
  const user = await userRepo.findByEmail(email);

  if (!user) {
    return apiResponse(401, {
      success: false,
      error: 'AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  // In mock mode, we compare against stored password/hash
  const passwordHash = createHash('sha256').update(password).digest('hex');
  const storedHash = user.passwordHash;

  if (storedHash && passwordHash !== storedHash) {
    return apiResponse(401, {
      success: false,
      error: 'AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  // If no hash (old seed data), compare directly
  if (!storedHash && user.password && password !== user.password) {
    return apiResponse(401, {
      success: false,
      error: 'AUTH_INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  // Generate mock JWT token
  const token = generateMockToken(user);

  const safeUser = toSafeUser(user);
  return success({ token, user: safeUser });
}

/**
 * Cognito login — authenticates against Cognito User Pool.
 * Uses the USER_PASSWORD_AUTH flow (requires ALLOW_USER_PASSWORD_AUTH enabled).
 */
async function cognitoLogin(email, password) {
  const { CognitoIdentityProviderClient, InitiateAuthCommand } = await import(
    '@aws-sdk/client-cognito-identity-provider'
  );

  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
  });

  try {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }));

    // Get user details from Cognito
    const user = await userRepo.findByEmail(email);

    return success({
      token: result.AuthenticationResult?.AccessToken,
      refreshToken: result.AuthenticationResult?.RefreshToken,
      idToken: result.AuthenticationResult?.IdToken,
      expiresIn: result.AuthenticationResult?.ExpiresIn,
      user: user ? toSafeUser(user) : { email },
    });
  } catch (err) {
    console.error('[auth/login] Cognito error:', err);

    if (err.name === 'NotAuthorizedException') {
      return apiResponse(401, {
        success: false,
        error: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (err.name === 'UserNotFoundException') {
      return apiResponse(401, {
        success: false,
        error: 'AUTH_USER_NOT_FOUND',
        message: 'User does not exist',
      });
    }

    return apiResponse(500, {
      success: false,
      error: 'AUTH_SERVICE_ERROR',
      message: 'Authentication service unavailable',
    });
  }
}

// ─── Me Handler ───────────────────────────────────────

/**
 * GET /auth/me — Returns current authenticated user.
 * Requires valid Bearer token (Cognito JWT or mock).
 */
export async function me(event) {
  const { authUser } = event;

  const user = await userRepo.findById(authUser.userId);

  if (!user) {
    return notFound('User not found');
  }

  return success({ user: toSafeUser(user) });
}

// ─── Helpers ──────────────────────────────────────────

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, password, PK, SK, GSI1PK, GSI1SK, ...safe } = user;
  return safe;
}

function generateMockToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    userId: user.id,
    role: user.role || 'EMPLOYEE',
    email: user.email,
    departmentId: user.departmentId || null,
    workspaceId: null,
  })).toString('base64');
  const signature = 'mock-signature-do-not-verify';
  return `${header}.${payload}.${signature}`;
}

// ─── Lambda Router for Auth ───────────────────────────

export async function handler(event) {
  const method = event.httpMethod;
  const path = event.path || '';

  if (method === 'OPTIONS') {
    return apiResponse(200, {});
  }

  if (method === 'POST' && path.endsWith('/login')) {
    return login(event);
  }

  if (method === 'GET' && path.endsWith('/me')) {
    // Wrap with auth middleware for the /me endpoint
    const wrapped = withAuth(async (evt) => me(evt));
    return wrapped(event);
  }

  return apiResponse(405, {
    success: false,
    error: 'METHOD_NOT_ALLOWED',
    message: `Method ${method} not allowed`,
  });
}

export default { handler, login, me };
