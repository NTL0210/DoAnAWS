import { getUserById } from '../../../src/services/userService';
import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile.
 * Requires a valid Bearer JWT token.
 *
 * Response: { success, data: { user } }
 */
async function handler(req, res) {
  try {
    const user = await getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'RESOURCE_NOT_FOUND',
      });
    }

    // Never expose sensitive fields
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'EMPLOYEE',
      departmentId: user.departmentId || null,
      avatar: user.avatar || null,
      phone: user.phone || '',
      avatarHistory: user.avatarHistory || [],
      createdAt: user.createdAt || null,
    };

    return res.status(200).json({
      success: true,
      data: { user: safeUser },
    });
  } catch (err) {
    console.error('[auth/me] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler);
