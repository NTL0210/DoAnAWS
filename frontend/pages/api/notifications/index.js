import { withAuth } from '../middleware/withAuth';

/**
 * GET /api/notifications — List notifications for current user
 * PATCH /api/notifications — Mark all as read (set query ?action=readAll)
 *
 * Headers: Authorization: Bearer <token>
 */

async function handler(req, res) {
  try {
    const { Notifications } = require('../../../src/repositories');
    const notificationsRepo = new Notifications();

    if (req.method === 'GET') {
      const notifications = await notificationsRepo.findByUserId(req.user.userId);
      const unreadCount = await notificationsRepo.getUnreadCount(req.user.userId);

      return res.status(200).json({
        success: true,
        data: { notifications, unreadCount },
      });
    }

    if (req.method === 'PATCH') {
      if (req.query?.action === 'readAll') {
        await notificationsRepo.markAllAsRead(req.user.userId);

        return res.status(200).json({
          success: true,
          message: 'All notifications marked as read',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Specify ?action=readAll or send PATCH to /api/notifications/[id]',
        error: 'VALIDATION_ERROR',
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
      error: 'METHOD_NOT_ALLOWED',
    });
  } catch (err) {
    console.error('[api/notifications] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler);
