/**
 * UserRepository interface (JSDoc contract)
 *
 * @interface UserRepository
 */

/**
 * Find user by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(id) { throw new Error('Not implemented'); }

/**
 * Find user by email
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export async function findByEmail(email) { throw new Error('Not implemented'); }

/**
 * Find all users
 * @returns {Promise<Object[]>}
 */
export async function findAll() { throw new Error('Not implemented'); }

/**
 * Create a new user
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function create(data) { throw new Error('Not implemented'); }

/**
 * Update a user
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function update(id, data) { throw new Error('Not implemented'); }

/**
 * Delete a user
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function delete_(id) { throw new Error('Not implemented'); }

export default { findById, findByEmail, findAll, create, update, delete_ };
