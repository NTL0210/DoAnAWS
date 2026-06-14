/**
 * NotificationRepository interface (JSDoc contract)
 *
 * @interface NotificationRepository
 */

/**
 * Find notifications for a user
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function findByUser(userId) { throw new Error('Not implemented'); }

/**
 * Find unread notifications for a user
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function findUnreadByUser(userId) { throw new Error('Not implemented'); }

/**
 * Create a new notification
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function create(data) { throw new Error('Not implemented'); }

/**
 * Mark notification as read
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function markAsRead(id) { throw new Error('Not implemented'); }

/**
 * Mark all notifications as read for a user
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function markAllAsRead(userId) { throw new Error('Not implemented'); }

export default { findByUser, findUnreadByUser, create, markAsRead, markAllAsRead };
