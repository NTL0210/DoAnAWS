/**
 * User entity — account-only, no global role
 *
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} [avatar]
 * @property {string} createdAt
 */

/**
 * Create a new User object
 * @param {Object} data
 * @returns {User}
 */
export function createUser(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    name: data.name || '',
    email: data.email || '',
    avatar: data.avatar || null,
    createdAt: data.createdAt || now,
  };
}
