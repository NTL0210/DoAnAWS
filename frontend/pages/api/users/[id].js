import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/users/[id] — Get user by ID
 *
 * Headers: Authorization: Bearer <token>
 *
 * Note:
 * - Admin can access any user.
 * - Manager can access users within their department.
 * - Employee can only access their own profile.
 */

async function handler(req, res) {
  try {
    const { id } = req.query;
    const { Users } = require('../../../src/repositories');
    const usersRepo = new Users();

    const user = await usersRepo.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'RESOURCE_NOT_FOUND',
      });
    }

    // Permission check
    if (req.user.role === 'EMPLOYEE' && req.user.userId !== id) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own profile',
        error: 'FORBIDDEN',
      });
    }

    if (req.user.role === 'MANAGER' && req.user.departmentId !== user.departmentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view users in your department',
        error: 'FORBIDDEN',
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      avatar: user.avatar,
      status: user.status,
    };

    return res.status(200).json({
      success: true,
      data: { user: safeUser },
    });
  } catch (err) {
    console.error('[api/users/:id] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler);
