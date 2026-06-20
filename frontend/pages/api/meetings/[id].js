import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/meetings/[id] — Get meeting details
 * POST /api/meetings/[id]/process — Trigger AI processing on a meeting
 *
 * Headers: Authorization: Bearer <token>
 */

async function handler(req, res) {
  try {
    const { meetingRepo } = require('../../../src/repositories');

    const meeting = await meetingRepo.findById(req.query.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
        error: 'RESOURCE_NOT_FOUND',
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        data: { meeting },
      });
    }

    // POST /api/meetings/[id]/process
    if (req.method === 'POST' && req.body?._action === 'process') {
      if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only managers and admins can process meetings',
          error: 'FORBIDDEN',
        });
      }

      // Update status to PROCESSING
      await meetingRepo.update(req.query.id, { status: 'PROCESSING' });

      // TODO: Trigger actual AI processing via async job/queue.
      // For MVP, the frontend calls legacy mockAI directly.
      // In production, this would enqueue an SQS/SNS message.

      return res.status(202).json({
        success: true,
        message: 'Meeting queued for AI processing',
        data: { meetingId: req.query.id, status: 'PROCESSING' },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/meetings/:id] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler);
