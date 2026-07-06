import { withAuth, apiResponse } from '../shared/cognitoAuth.js';
import { success, notFound, badRequest } from '../shared/router.js';
import * as userRepo from '../../src/dynamodb/repositories/userRepository.js';

const { COGNITO_CLIENT_ID } = process.env;

export async function login(event) {
  const { email, password } = event.parsedBody || {};

  if (!email || !password) {
    return badRequest('Email and password are required');
  }

  return cognitoLogin(email, password);
}

async function cognitoLogin(email, password) {
  if (!COGNITO_CLIENT_ID) {
    return apiResponse(500, {
      success: false,
      error: 'AUTH_NOT_CONFIGURED',
      message: 'Cognito client is not configured',
    });
  }

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

export async function me(event) {
  const { authUser } = event;
  const user = await userRepo.findById(authUser.userId);

  if (!user) {
    return notFound('User not found');
  }

  return success({ user: toSafeUser(user) });
}

function toSafeUser(user) {
  if (!user) return null;
  const { passwordHash, password, PK, SK, GSI1PK, GSI1SK, ...safe } = user;
  return safe;
}

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
