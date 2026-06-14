import { withAuth } from '../middleware/withAuth';
import { withValidation } from '../middleware/withValidation';
import { getWorkspacesForUser, createWorkspace } from '../../../src/services/workspaceService';

/**
 * GET /api/workspaces — List workspaces for the current user
 * POST /api/workspaces — Create a new workspace (admin only)
 *
 * Headers: Authorization: Bearer <token>
 */

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const workspaces = await getWorkspacesForUser(req.user.userId);

      return res.status(200).json({
        success: true,
        data: { workspaces },
      });
    }

    if (req.method === 'POST') {

      const workspace = await createWorkspace({
        ...req.body,
        ownerId: req.user.userId,
      });

      return res.status(201).json({
        success: true,
        message: 'Workspace created successfully',
        data: { workspace },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/workspaces] Error:', err.message);
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
    slug: { required: false, type: 'string' },
  },
};

export default withValidation(withAuth(handler), schema);
