import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/dashboard/admin — Company-wide analytics for admin
 *
 * Headers: Authorization: Bearer <token>
 * Role: ADMIN
 */

async function handler(req, res) {
  try {
    const { userRepo, taskRepo, meetingRepo } = require('../../../src/repositories');

    const [users, tasks, meetings] = await Promise.all([
      userRepo.findAll(),
      taskRepo.findAll(),
      meetingRepo.findAll(),
    ]);

    const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
    const completedMeetings = meetings.filter((m) => m.status === 'COMPLETED').length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const overdueTasks = tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length;

    const avgProgress = tasks.length
      ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
      : 0;

    const roleDist = {
      ADMIN: users.filter((u) => u.role === 'ADMIN').length,
      MANAGER: users.filter((u) => u.role === 'MANAGER').length,
      EMPLOYEE: users.filter((u) => u.role === 'EMPLOYEE').length,
    };

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: users.length,
        activeUsers,
        totalMeetings: meetings.length,
        completedMeetings,
        totalTasks: tasks.length,
        completedTasks,
        overdueTasks,
        avgProgress,
        roleDist,
      },
    });
  } catch (err) {
    console.error('[api/dashboard/admin] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler, { roles: ['ADMIN'] });
