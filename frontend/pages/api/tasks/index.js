import { withAuth } from '../middleware/withAuth';
import { withValidation } from '../middleware/withValidation';

/**
 * GET /api/tasks — List tasks (with optional filters)
 * POST /api/tasks — Create a new task
 *
 * Query filters (GET): status, priority, assigneeId, departmentId, meetingId
 * Body (POST): title, description, assigneeId, departmentId, priority, deadline, meetingId
 *
 * Role rules:
 * - ADMIN: all tasks
 * - MANAGER: tasks in own department
 * - EMPLOYEE: own tasks only
 */

async function handler(req, res) {
  try {
    const { taskRepo } = require('../../../src/repositories');

    if (req.method === 'GET') {
      const { status, priority, assigneeId, departmentId, meetingId } = req.query;

      // Role-based scope
      let results;

      if (req.user.role === 'ADMIN') {
        // Admin can access everything
        if (departmentId) {
          results = await taskRepo.findByDepartment(departmentId);
        } else if (assigneeId) {
          results = await taskRepo.findByAssignee(assigneeId);
        } else if (meetingId) {
          results = await taskRepo.findByMeeting(meetingId);
        } else if (status) {
          const all = await taskRepo.findAll();
          results = all.filter((t) => t.status === status);
        } else {
          const all = await taskRepo.findAll();
          results = all;
        }
      } else if (req.user.role === 'MANAGER') {
        // Manager sees department tasks
        results = await taskRepo.findByDepartment(req.user.departmentId);
      } else {
        // Employee sees own tasks
        results = await taskRepo.findByAssignee(req.user.userId);
      }

      // Apply remaining filters client-side (or extend repo for complex queries)
      if (status && !departmentId && !assigneeId && !meetingId) {
        results = results.filter((t) => t.status === status);
      }
      if (priority) {
        results = results.filter((t) => t.priority === priority);
      }

      return res.status(200).json({
        success: true,
        data: { tasks: results },
        count: results.length,
      });
    }

    if (req.method === 'POST') {
      const taskData = {
        ...req.body,
        createdBy: req.user.userId,
        departmentId: req.body.departmentId || req.user.departmentId,
      };

      const created = await taskRepo.create(taskData);

      return res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: { task: created },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/tasks] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

const schema = {
  body: {
    title: { required: true, type: 'string', minLength: 1 },
    description: { required: false, type: 'string' },
    assigneeId: { required: false, type: 'string' },
    priority: { required: false, type: 'string', oneOf: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    deadline: { required: false, type: 'string' },
    meetingId: { required: false, type: 'string' },
    departmentId: { required: false, type: 'string' },
  },
};

export default withValidation(withAuth(handler), schema);
