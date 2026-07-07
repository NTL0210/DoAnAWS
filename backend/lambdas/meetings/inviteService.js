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
import * as invitationRepo from '../../src/dynamodb/repositories/invitationRepository.js';
import * as userRepo from '../../src/dynamodb/repositories/userRepository.js';
import * as workspaceRepo from '../../src/dynamodb/repositories/workspaceRepository.js';
import { updateItem } from '../../src/dynamodb/client.js';
import { success, created, notFound, badRequest } from '../shared/router.js';

/**
 * POST /meetings/invite
 *
 * Creates an invitation notification for the invited user.
 * - If user exists: creates a notification
 * - If user doesn't exist: creates an invitation record for later processing
 *
 * @param {Object} event - Lambda event with parsedBody
 * @returns {Object} API Gateway response
 */
export async function handleInvite(event) {
  const { parsedBody, authUser } = event;
  const { workspaceId, workspaceName, inviteeEmail, role, teamIds } = parsedBody || {};

  if (!workspaceId || !inviteeEmail || !role) {
    return badRequest('workspaceId, inviteeEmail, and role are required');
  }

  const normalizedEmail = inviteeEmail.trim().toLowerCase();

  // Don't allow inviting yourself
  if (authUser.email && authUser.email.toLowerCase() === normalizedEmail) {
    return badRequest('You cannot invite yourself');
  }

  // Look up the invited user by email
  const invitedUser = await userRepo.findByEmail(normalizedEmail);

  if (invitedUser) {
    // User exists — create a notification
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
        invitedEmail: normalizedEmail,
        teamIds: Array.isArray(teamIds) ? teamIds : [],
      },
    });

    return created({ notification });
  } else {
    // User doesn't exist yet — create an invitation record
    // This will be processed when the user registers
    const invitation = await invitationRepo.create({
      workspaceId,
      workspaceName: workspaceName || '',
      inviteeEmail: normalizedEmail,
      role: role || 'EMPLOYEE',
      teamIds: Array.isArray(teamIds) ? teamIds : [],
      invitedBy: authUser.userId,
      invitedByUserName: authUser.name || 'Unknown',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    return created({
      invitation,
      message: 'Invitation created. User will see it when they register.',
    });
  }
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
 * When accepting, also adds the user as a workspace member.
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
  if (action === 'accept') {
    const metadata = { ...(notification.metadata || {}), status: 'ACCEPTED' };
    const key = {
      PK: `NOTIF#${authUser.userId}`,
      SK: `NOTIF#${resourceId}`,
    };
    const updated = await updateItem(key, {
      metadata,
      isRead: true,
    });

    // Add user as workspace member
    const workspaceId = notification.metadata?.workspaceId;
    const role = notification.metadata?.role || 'EMPLOYEE';
    if (workspaceId) {
      try {
        const existingMembers = await workspaceRepo.getMembers(workspaceId);
        const isMember = existingMembers.some((m) => m.userId === authUser.userId);
        if (!isMember) {
          // Map 'OWNER' invite role to 'ADMIN' (don't give raw ownership to invitee)
          const memberRole = (role === 'OWNER' || role === 'VICE_ADMIN') ? 'ADMIN' : role;
          await workspaceRepo.addMember(workspaceId, authUser.userId, memberRole);
        }
      } catch (err) {
        console.error(`[Invite] Failed to add member ${authUser.userId} to workspace ${workspaceId}:`, err);
      }
    }

    return success({ notification: updated });
  }

  if (action === 'decline') {
    const metadata = { ...(notification.metadata || {}), status: 'DECLINED' };
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
