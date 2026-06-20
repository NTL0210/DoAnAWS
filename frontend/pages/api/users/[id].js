import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/users/[id] — Get user by ID
 * PATCH /api/users/[id] — Update user profile
 *
 * Headers: Authorization: Bearer <token>
 *
 * Note:
 * - Admin can access/update any user.
 * - Manager can access users within their department.
 * - Employee can only access their own profile.
 */

async function handler(req, res) {
  try {
    const { id } = req.query;
    const { getUserById } = require('../../../src/services/userService');

    // ── GET ──
    if (req.method === 'GET') {
      const user = await getUserById(id);

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
        phone: user.phone || '',
        avatarHistory: user.avatarHistory || [],
        status: user.status,
      };

      return res.status(200).json({
        success: true,
        data: { user: safeUser },
      });
    }

    // ── PATCH ──
    if (req.method === 'PATCH') {
      // Must be the user themselves OR admin
      if (req.user.role !== 'ADMIN' && req.user.userId !== id) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own profile',
          error: 'FORBIDDEN',
        });
      }

      const { userRepo } = require('../../../src/repositories');
      const current = await userRepo.findById(id);
      if (!current) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'RESOURCE_NOT_FOUND',
        });
      }

      const allowedFields = ['name', 'avatar', 'phone', 'avatarHistory'];
      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      // Validate avatarHistory max 5
      if (updates.avatarHistory && updates.avatarHistory.length > 5) {
        updates.avatarHistory = updates.avatarHistory.slice(0, 5);
      }

      const updated = await userRepo.update(id, updates);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            role: updated.role,
            departmentId: updated.departmentId,
            avatar: updated.avatar,
            phone: updated.phone || '',
            avatarHistory: updated.avatarHistory || [],
            status: updated.status,
          },
        },
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
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
