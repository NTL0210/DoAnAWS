/**
 * MessageRepository interface (JSDoc contract)
 *
 * @interface MessageRepository
 */

/**
 * Find messages by channel
 * @param {string} channelId
 * @returns {Promise<Object[]>}
 */
export async function findByChannel(channelId) { throw new Error('Not implemented'); }

/**
 * Find messages by team chat key
 * @param {string} teamChatKey
 * @returns {Promise<Object[]>}
 */
export async function findByTeamChat(teamChatKey) { throw new Error('Not implemented'); }

/**
 * Create a new message
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function create(data) { throw new Error('Not implemented'); }

/**
 * Delete a message
 * @param {string} messageId
 * @returns {Promise<void>}
 */
export async function delete_(messageId) { throw new Error('Not implemented'); }

export default { findByChannel, findByTeamChat, create, delete_ };
