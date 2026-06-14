/**
 * TeamRepository interface (JSDoc contract)
 *
 * @interface TeamRepository
 */

/**
 * Find team by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(id) { throw new Error('Not implemented'); }

/**
 * Find teams by workspace
 * @param {string} workspaceId
 * @returns {Promise<Object[]>}
 */
export async function findByWorkspace(workspaceId) { throw new Error('Not implemented'); }

/**
 * Create a new team
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function create(data) { throw new Error('Not implemented'); }

/**
 * Update a team
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function update(id, data) { throw new Error('Not implemented'); }

/**
 * Delete a team
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function delete_(id) { throw new Error('Not implemented'); }

export default { findById, findByWorkspace, create, update, delete_ };
