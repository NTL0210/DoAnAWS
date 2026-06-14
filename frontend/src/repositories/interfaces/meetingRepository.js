/**
 * MeetingRepository interface (JSDoc contract)
 *
 * @interface MeetingRepository
 */

/**
 * Find meeting by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(id) { throw new Error('Not implemented'); }

/**
 * Find meetings by workspace
 * @param {string} workspaceId
 * @returns {Promise<Object[]>}
 */
export async function findByWorkspace(workspaceId) { throw new Error('Not implemented'); }

/**
 * Find recent meetings in a workspace
 * @param {string} workspaceId
 * @param {number} [limit]
 * @returns {Promise<Object[]>}
 */
export async function findRecentByWorkspace(workspaceId, limit = 10) { throw new Error('Not implemented'); }

/**
 * Create a new meeting
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function create(data) { throw new Error('Not implemented'); }

/**
 * Update a meeting
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function update(id, data) { throw new Error('Not implemented'); }

/**
 * Delete a meeting
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function delete_(id) { throw new Error('Not implemented'); }

export default { findById, findByWorkspace, findRecentByWorkspace, create, update, delete_ };
