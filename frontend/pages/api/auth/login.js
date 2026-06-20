import { loginUser } from '../../../src/services/userService';

/**
 * Generate a simple encoded token for mock/dev authentication.
 * Matches the decoding logic in withAuth middleware:
 *   token.split('.')[1] → base64 → JSON.parse → { sub, role, email }
 *
 * In production, replace with Amazon Cognito JWT.
 */
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

/**
 * POST /api/auth/login
 *
 * Authenticates a user by email and password.
 * Returns a JWT token and current user data.
 *
 * Body: { email: string, password: string }
 * Response: { success, data: { token, user } }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        error: 'VALIDATION_ERROR',
      });
    }

    const user = await loginUser(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    const token = generateMockToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user },
    });
  } catch (err) {
    console.error('[auth/login] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}
