import { withAuth } from '../middleware/withAuth';
import { withValidation } from '../middleware/withValidation';

/**
 * GET /api/users — List all users (admin only)
 * POST /api/users — Create a new user (admin only)
 *
 * Headers: Authorization: Bearer <token>
 */

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { Users } = require('../../../src/repositories');
      const usersRepo = new Users();
      const users = await usersRepo.findAll();

      const safeUsers = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        departmentId: u.departmentId,
        avatar: u.avatar,
        status: u.status,
      }));

      return res.status(200).json({
        success: true,
        data: { users: safeUsers },
      });
    }

    if (req.method === 'POST') {
      const { registerUser } = require('../../../src/services/userService');
      const result = await registerUser(req.body);

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: result.user },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/users] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

const schema = {
  body: {
    name: { required: true, type: 'string', minLength: 1 },
    email: { required: true, type: 'string', minLength: 3 },
    password: { required: true, type: 'string', minLength: 6 },
    role: { required: false, type: 'string', oneOf: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
    departmentId: { required: false, type: 'string' },
  },
};

export default withValidation(withAuth(handler, { roles: ['ADMIN'] }), schema);
