import { notificationRepo } from '../../../src/repositories';
import { withAuth } from '../middleware/withAuth';

/**
 * PATCH /api/notifications/[id] — Mark a single notification as read
 *
 * Headers: Authorization: Bearer <token>
 */

async function handler(req, res) {
  try {
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', ['PATCH']);
      return res.status(405).json({
        success: false,
        message: `Method ${req.method} not allowed`,
        error: 'METHOD_NOT_ALLOWED',
      });
    }

    const notification = await notificationRepo.findById(req.query.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        error: 'RESOURCE_NOT_FOUND',
      });
    }

    // Ensure the notification belongs to the current user
    if (notification.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage your own notifications',
        error: 'FORBIDDEN',
      });
    }

    const updated = await notificationRepo.markAsRead(req.query.id);

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: updated },
    });
  } catch (err) {
    console.error('[api/notifications/:id] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR',
    });
  }
}

export default withAuth(handler);
