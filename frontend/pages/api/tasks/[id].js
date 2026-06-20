import { withAuth } from '../middleware/withAuth';
import { withValidation } from '../middleware/withValidation';

/**
 * GET /api/tasks/[id] — Get a task by ID
 * PATCH /api/tasks/[id] — Update a task
 * DELETE /api/tasks/[id] — Delete a task (admin only)
 */

async function handler(req, res) {
  try {
    const { taskRepo } = require('../../../src/repositories');

    const task = await taskRepo.findById(req.query.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
        error: 'RESOURCE_NOT_FOUND',
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        data: { task },
      });
    }

    if (req.method === 'PATCH') {
      // Role-based update permissions
      if (req.user.role === 'EMPLOYEE' && task.assigneeId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own tasks',
          error: 'FORBIDDEN',
        });
      }

      // Employees can only update status and progress
      if (req.user.role === 'EMPLOYEE') {
        const allowedFields = ['status', 'progress', 'description'];
        const updates = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
          }
        }
        const updated = await taskRepo.update(req.query.id, updates);

        return res.status(200).json({
          success: true,
          message: 'Task updated',
          data: { task: updated },
        });
      }

      // Manager/Admin: full update
      const updated = await taskRepo.update(req.query.id, req.body);

      return res.status(200).json({
        success: true,
        message: 'Task updated',
        data: { task: updated },
      });
    }

    if (req.method === 'DELETE') {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can delete tasks',
          error: 'FORBIDDEN',
        });
      }

      await taskRepo.delete_(req.query.id);

      return res.status(200).json({
        success: true,
        message: 'Task deleted',
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/tasks/:id] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

const schema = {
  body: {
    title: { required: false, type: 'string', minLength: 1 },
    status: { required: false, type: 'string', oneOf: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'] },
    priority: { required: false, type: 'string', oneOf: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    assigneeId: { required: false, type: 'string' },
    progress: { required: false, type: 'number' },
    deadline: { required: false, type: 'string' },
  },
};

export default withValidation(withAuth(handler), schema);
