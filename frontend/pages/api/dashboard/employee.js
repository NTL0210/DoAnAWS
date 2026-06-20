import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/dashboard/employee — Personal task overview for employees
 *
 * Headers: Authorization: Bearer <token>
 * Role: EMPLOYEE
 */

async function handler(req, res) {
  try {
    const { taskRepo } = require('../../../src/repositories');

    const myTasks = await taskRepo.findByAssignee(req.user.userId);

    const pending = myTasks.filter((t) => t.status === 'PENDING').length;
    const inProgress = myTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const completed = myTasks.filter((t) => t.status === 'COMPLETED').length;
    const overdue = myTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length;
    const avgProgress = myTasks.length
      ? Math.round(myTasks.reduce((s, t) => s + t.progress, 0) / myTasks.length)
      : 0;

    const nextTask = [...myTasks]
      .filter((t) => t.status !== 'COMPLETED')
      .sort((a, b) => new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01'))
      .slice(0, 1);

    return res.status(200).json({
      success: true,
      data: {
        totalTasks: myTasks.length,
        pending,
        inProgress,
        completed,
        overdue,
        avgProgress,
        nextTask: nextTask.length > 0 ? nextTask[0] : null,
      },
    });
  } catch (err) {
    console.error('[api/dashboard/employee] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler, { roles: ['EMPLOYEE'] });
