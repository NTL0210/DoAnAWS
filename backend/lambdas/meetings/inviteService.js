/**
 * Invite & Notification Service
 *
 * Handles workspace invitations via the DynamoDB notification repository.
 * Used by the meetings Lambda (which has the {proxy+} API Gateway route)
 * to process invite requests.
 *
 * Routes (handled via controller routing):
 *   POST /meetings/invite     — create invitation notification
 *   GET  /meetings/notifications — list notifications for a user
 *   PATCH /meetings/notifications/{id} — update notification (accept/decline/read)
 *
 * @module lambdas/meetings/inviteService
 */

import * as notificationRepo from '../../src/dynamodb/repositories/notificationRepository.js';
import * as userRepo from '../../src/dynamodb/repositories/userRepository.js';
import { updateItem } from '../../src/dynamodb/client.js';
import { success, created, notFound, badRequest } from '../shared/router.js';

/**
 * POST /meetings/invite
 *
 * Creates an invitation notification for the invited user.
 * Looks up the user by email, creates a notification with INVITATION type
 * and PENDING status in metadata.
 *
 * @param {Object} event - Lambda event with parsedBody
 * @returns {Object} API Gateway response
 */
export async function handleInvite(event) {
  const { parsedBody, authUser } = event;
  const { workspaceId, workspaceName, inviteeEmail, role } = parsedBody || {};

  if (!workspaceId || !inviteeEmail || !role) {
    return badRequest('workspaceId, inviteeEmail, and role are required');
  }

  // Look up the invited user by email
  const invitedUser = await userRepo.findByEmail(inviteeEmail.trim().toLowerCase());
  if (!invitedUser) {
    return notFound('User with this email was not found');
  }

  // Don't allow inviting yourself
  if (authUser.userId === invitedUser.id) {
    return badRequest('You cannot invite yourself');
  }

  // Create invitation notification
  const notification = await notificationRepo.create({
    userId: invitedUser.id,
    type: 'INVITATION',
    title: 'Workspace Invitation',
    message: `${authUser.name || 'Someone'} invited you to join "${workspaceName || workspaceId}"`,
    link: null,
    metadata: {
      type: 'workspace_invite',
      workspaceId,
      workspaceName: workspaceName || '',
      role,
      invitedBy: authUser.userId,
      invitedByUserName: authUser.name || 'Unknown',
      status: 'PENDING',
      invitedEmail: inviteeEmail.trim().toLowerCase(),
    },
  });

  return created({ notification });
}

/**
 * GET /meetings/notifications
 *
 * Returns notifications for the authenticated user.
 * Query params: unreadOnly (boolean)
 *
 * @param {Object} event - Lambda event with queryStringParameters
 * @returns {Object} API Gateway response
 */
export async function handleGetNotifications(event) {
  const { authUser, queryStringParameters } = event;
  const q = queryStringParameters || {};
  const userId = authUser.userId;

  const notifications = await notificationRepo.findByUser(userId, {
    unreadOnly: q.unreadOnly === 'true',
    limit: parseInt(q.limit || '50', 10),
  });

  return success({ notifications });
}

/**
 * PATCH /meetings/notifications/{id}
 *
 * Updates a notification — used to mark as read, accept, or decline an invitation.
 * Body: { action: 'read' | 'accept' | 'decline' }
 *
 * @param {Object} event - Lambda event with resourceId and parsedBody
 * @returns {Object} API Gateway response
 */
export async function handleUpdateNotification(event) {
  const { resourceId, parsedBody, authUser } = event;
  const { action } = parsedBody || {};

  if (!resourceId) {
    return badRequest('notificationId is required');
  }

  if (!action || !['read', 'accept', 'decline'].includes(action)) {
    return badRequest('action must be one of: read, accept, decline');
  }

  // Fetch the notification first
  const notification = await notificationRepo.findById(authUser.userId, resourceId);
  if (!notification) {
    return notFound('Notification not found');
  }

  if (action === 'read') {
    const updated = await notificationRepo.markAsRead(authUser.userId, resourceId);
    return success({ notification: updated });
  }

  // Accept or decline an invitation
  if (action === 'accept' || action === 'decline') {
    const metadata = { ...(notification.metadata || {}), status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' };
    const key = {
      PK: `NOTIF#${authUser.userId}`,
      SK: `NOTIF#${resourceId}`,
    };
    const updated = await updateItem(key, {
      metadata,
      isRead: true,
    });
    return success({ notification: updated });
  }

  return badRequest('Unknown action');
}

export default { handleInvite, handleGetNotifications, handleUpdateNotification };
