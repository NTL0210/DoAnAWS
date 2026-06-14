import { loginUser } from '../../../src/services/userService';

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

    const result = await loginUser(email, password);

    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: result.token,
        user: result.user,
      },
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
