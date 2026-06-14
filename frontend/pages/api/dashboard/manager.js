import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/dashboard/manager — Department-level analytics for managers
 *
 * Headers: Authorization: Bearer <token>
 * Role: MANAGER
 */

async function handler(req, res) {
  try {
    const { Users, Tasks, Meetings } = require('../../../src/repositories');

    const usersRepo = new Users();
    const tasksRepo = new Tasks();
    const meetingsRepo = new Meetings();

    const deptId = req.user.departmentId;

    const [users, tasks, meetings] = await Promise.all([
      usersRepo.findAll(),
      tasksRepo.findAll(),
      meetingsRepo.findAll(),
    ]);

    const teamMembers = users.filter((u) => u.departmentId === deptId && u.role !== 'MANAGER');
    const deptTasks = tasks.filter((t) => t.departmentId === deptId);
    const deptMeetings = meetings.filter((m) => m.departmentId === deptId);

    const completed = deptTasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgress = deptTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const pending = deptTasks.filter((t) => t.status === 'PENDING').length;
    const overdue = deptTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length;
    const avgProgress = deptTasks.length
      ? Math.round(deptTasks.reduce((s, t) => s + t.progress, 0) / deptTasks.length)
      : 0;

    const workload = teamMembers.map((member) => {
      const memberTasks = deptTasks.filter((t) => t.assigneeId === member.id);
      return {
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        taskCount: memberTasks.length,
        completed: memberTasks.filter((t) => t.status === 'COMPLETED').length,
        overdue: memberTasks.filter(
          (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
        ).length,
        progress: memberTasks.length
          ? Math.round((memberTasks.filter((t) => t.status === 'COMPLETED').length / memberTasks.length) * 100)
          : 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        totalTasks: deptTasks.length,
        completed,
        inProgress,
        pending,
        overdue,
        avgProgress,
        totalMembers: teamMembers.length,
        totalMeetings: deptMeetings.length,
        workload,
      },
    });
  } catch (err) {
    console.error('[api/dashboard/manager] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler, { roles: ['MANAGER'] });
