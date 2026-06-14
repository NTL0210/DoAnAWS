import { withAuth } from '../middleware/withAuth';
import { withValidation } from '../middleware/withValidation';

/**
 * GET /api/meetings — List meetings
 * POST /api/meetings — Create a new meeting (upload)
 *
 * Role rules:
 * - ADMIN: all meetings
 * - MANAGER: meetings in own department
 * - EMPLOYEE: meetings related to their tasks
 */

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { Meetings } = require('../../../src/repositories');
      const meetingsRepo = new Meetings();

      let results;

      if (req.user.role === 'ADMIN') {
        results = await meetingsRepo.findAll();
      } else if (req.user.role === 'MANAGER') {
        results = await meetingsRepo.findByDepartment(req.user.departmentId);
      } else {
        // Employee: find meetings related to their tasks
        const { Tasks } = require('../../../src/repositories');
        const tasksRepo = new Tasks();
        const myTasks = await tasksRepo.findByAssignee(req.user.userId);
        const meetingIds = [...new Set(myTasks.map((t) => t.meetingId).filter(Boolean))];
        const allMeetings = await meetingsRepo.findAll();
        results = allMeetings.filter((m) => meetingIds.includes(m.id));
      }

      return res.status(200).json({
        success: true,
        data: { meetings: results },
        count: results.length,
      });
    }

    if (req.method === 'POST') {
      const { Meetings } = require('../../../src/repositories');
      const meetingsRepo = new Meetings();

      if (req.user.role === 'EMPLOYEE') {
        return res.status(403).json({
          success: false,
          message: 'Employees cannot upload meetings',
          error: 'FORBIDDEN',
        });
      }

      const meetingData = {
        ...req.body,
        uploadedBy: req.user.userId,
        departmentId: req.body.departmentId || req.user.departmentId,
        status: 'UPLOADED',
      };

      const created = await meetingsRepo.create(meetingData);

      return res.status(201).json({
        success: true,
        message: 'Meeting uploaded successfully',
        data: { meeting: created },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/meetings] Error:', err.message);
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
    transcriptText: { required: false, type: 'string' },
    departmentId: { required: false, type: 'string' },
  },
};

export default withValidation(withAuth(handler), schema);
