/**
 * DynamoDB Notification Repository — single-table implementation
 *
 * Access patterns:
 *   - Get notification: PK = NOTIF#{userId}, SK = NOTIF#{notifId}
 *   - List by user:     PK = NOTIF#{userId}, SK begins_with NOTIF#
 *   - Unread first:     Sort SK descending (newest first)
 *
 * @module dynamodb/repositories/notificationRepository
 */

import { getItem, putItem, updateItem, queryItems } from '../client.js';
import { ENTITY, pk } from '../entityTypes.js';

/**
 * Build the full DynamoDB item for a notification.
 *
 * @param {Object} notif - Notification data
 * @returns {Object} DynamoDB record
 */
function toRecord(notif) {
  const now = new Date().toISOString();
  return {
    PK: pk(ENTITY.NOTIFICATION, notif.userId),
    SK: `NOTIF#${notif.id}`,
    id: notif.id,
    userId: notif.userId,
    type: notif.type || 'INFO',        // TASK_ASSIGNED | MEETING_READY | DEADLINE | INFO
    title: notif.title,
    message: notif.message || '',
    link: notif.link || null,
    isRead: Boolean(notif.isRead),
    createdAt: notif.createdAt || now,
    expiresAt: notif.expiresAt || undefined,  // TTL
  };
}

/**
 * Convert a DynamoDB record back to a plain notification object.
 *
 * @param {Object} record
 * @returns {Object|null}
 */
function fromRecord(record) {
  if (!record) return null;
  const { PK, SK, ...notif } = record;
  return notif;
}

/**
 * Get a specific notification by user ID and notification ID.
 * @param {string} userId
 * @param {string} notifId
 * @returns {Promise<Object|null>}
 */
export async function findById(userId, notifId) {
  const record = await getItem({
    PK: pk(ENTITY.NOTIFICATION, userId),
    SK: `NOTIF#${notifId}`,
  });
  return fromRecord(record);
}

/**
 * List notifications for a user, newest first.
 * @param {string} userId
 * @param {Object} [options]
 * @param {boolean} [options.unreadOnly] - Only return unread
 * @param {number} [options.limit=50]
 * @returns {Promise<Object[]>}
 */
export async function findByUser(userId, options = {}) {
  const { items } = await queryItems({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk(ENTITY.NOTIFICATION, userId),
      ':sk': 'NOTIF#',
    },
    ScanIndexForward: false,  // newest first
    Limit: options.limit || 50,
  });

  let notifications = items.map(fromRecord).filter(Boolean);

  if (options.unreadOnly) {
    notifications = notifications.filter((n) => !n.isRead);
  }

  return notifications;
}

/**
 * Get count of unread notifications for a user.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getUnreadCount(userId) {
  const notifications = await findByUser(userId, { unreadOnly: true });
  return notifications.length;
}

/**
 * Create a notification.
 * @param {Object} notifData
 * @returns {Promise<Object>}
 */
export async function create(notifData) {
  const record = toRecord({
    id: notifData.id || 'notif-' + Date.now().toString(36),
    userId: notifData.userId,
    type: notifData.type || 'INFO',
    title: notifData.title || '',
    message: notifData.message || '',
    link: notifData.link || null,
    isRead: false,
    createdAt: new Date().toISOString(),
    expiresAt: notifData.expiresAt,
  });
  await putItem(record);
  return fromRecord(record);
}

/**
 * Mark a notification as read.
 * @param {string} userId
 * @param {string} notifId
 * @returns {Promise<Object|null>}
 */
export async function markAsRead(userId, notifId) {
  const key = { PK: pk(ENTITY.NOTIFICATION, userId), SK: `NOTIF#${notifId}` };
  const updated = await updateItem(key, {
    isRead: true,
  });
  return updated ? fromRecord(updated) : null;
}

/**
 * Mark all notifications for a user as read.
 * @param {string} userId
 * @returns {Promise<number>} Number marked as read
 */
export async function markAllAsRead(userId) {
  const notifications = await findByUser(userId, { unreadOnly: true });
  let count = 0;
  for (const notif of notifications) {
    await markAsRead(userId, notif.id);
    count++;
  }
  return count;
}

export default { findById, findByUser, getUnreadCount, create, markAsRead, markAllAsRead };
