import { withAuth } from '../../../middleware/withAuth';
import { getTeamsByWorkspace, createTeam } from '../../../../../src/services/teamService';

/**
 * GET /api/workspaces/[id]/teams — List teams in a workspace
 * POST /api/workspaces/[id]/teams — Create a team in a workspace (admin/manager)
 *
 * Headers: Authorization: Bearer <token>
 */

async function handler(req, res) {
  try {
    const workspaceId = req.query.id;

    if (req.method === 'GET') {
      const teams = await getTeamsByWorkspace(workspaceId);

      return res.status(200).json({
        success: true,
        data: { teams },
      });
    }

    if (req.method === 'POST') {
      if (req.user.role === 'EMPLOYEE') {
        return res.status(403).json({
          success: false,
          message: 'Employees cannot create teams',
          error: 'FORBIDDEN',
        });
      }

      const team = await createTeam({
        ...req.body,
        workspaceId,
      });

      return res.status(201).json({
        success: true,
        message: 'Team created successfully',
        data: { team },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/workspaces/:id/teams] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler);
