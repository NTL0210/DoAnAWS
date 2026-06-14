/**
 * Workspace entity
 *
 * @typedef {Object} Workspace
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string} ownerId
 * @property {Array<Channel>} channels
 * @property {Array<Team>} teams
 * @property {Array<WorkspaceMember>} members
 * @property {Array<CustomRole>} [customRoles]
 * @property {Array<Feature>} [features]
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} WorkspaceMember
 * @property {string} userId
 * @property {'OWNER'|'VICE_ADMIN'|'MANAGER'|'EMPLOYEE'} role
 * @property {string} joinedAt
 * @property {string|null} [nickname]
 *
 * @typedef {Object} CustomRole
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string[]} permissions
 * @property {string} [color]
 * @property {boolean} [isSystem]
 *
 * @typedef {Object} Feature
 * @property {string} id
 * @property {string} name
 * @property {string} [icon]
 * @property {boolean} enabled
 */

export const WORKSPACE_ROLES = {
  OWNER: 'OWNER',
  VICE_ADMIN: 'VICE_ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
};

export const WORKSPACE_ROLE_LABELS = {
  OWNER: 'Owner',
  VICE_ADMIN: 'Vice Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

export const WORKSPACE_ROLE_COLORS = {
  OWNER: 'bg-red-100 text-red-700',
  VICE_ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  EMPLOYEE: 'bg-green-100 text-green-700',
};

/**
 * Create a new Workspace object
 * @param {Object} data
 * @returns {Workspace}
 */
export function createWorkspace(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    name: data.name || '',
    slug: data.slug || '',
    ownerId: data.ownerId || '',
    channels: data.channels || [],
    teams: data.teams || [],
    members: data.members || [],
    customRoles: data.customRoles || [],
    features: data.features || [],
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}
