/**
 * Team entity
 *
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} workspaceId
 * @property {string} name
 * @property {string} [description]
 * @property {string} [color]
 * @property {string} [managerId]
 * @property {string[]} [memberIds]
 * @property {string} createdAt
 * @property {string} [updatedAt]
 */

/**
 * Create a new Team object
 * @param {Object} data
 * @returns {Team}
 */
export function createTeam(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    workspaceId: data.workspaceId,
    name: data.name || '',
    description: data.description || '',
    color: data.color || '#5865F2',
    managerId: data.managerId || null,
    memberIds: data.memberIds || [],
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}
