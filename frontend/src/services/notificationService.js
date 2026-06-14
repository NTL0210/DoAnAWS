/**
 * NotificationService — business logic for notifications
 */

import { notificationRepo } from '@/repositories';
import { generateId } from '@/services/workspaceService';

/**
 * Get notifications for a user
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function getNotificationsForUser(userId) {
  return notificationRepo.findByUser(userId);
}

/**
 * Get unread notification count for a user
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getUnreadCount(userId) {
  const unread = await notificationRepo.findUnreadByUser(userId);
  return unread.length;
}

/**
 * Create a notification
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function createNotification(data) {
  return notificationRepo.create({
    id: 'ntf-' + generateId(),
    ...data,
    isRead: false,
  });
}

/**
 * Mark a notification as read
 * @param {string} notificationId
 * @returns {Promise<Object|null>}
 */
export async function markAsRead(notificationId) {
  return notificationRepo.markAsRead(notificationId);
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function markAllAsRead(userId) {
  return notificationRepo.markAllAsRead(userId);
}
