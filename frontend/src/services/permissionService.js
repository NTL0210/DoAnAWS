/**
 * PermissionService — workspace-scoped permission checking
 *
 * Extracted from src/lib/workspaceData.js helpers.
 * Uses DEFAULT_ROLES and workspace custom roles to check permissions.
 */

import { DEFAULT_ROLES, getDefaultPermissionsForRole } from '@/data/defaults/roles';

/**
 * Get the role of a user in a workspace
 * @param {Object} workspace
 * @param {string} userId
 * @returns {string|null}
 */
export function getWorkspaceRole(workspace, userId) {
  if (!workspace || !userId) return null;
  const member = workspace.members?.find((m) => m.userId === userId);
  return member ? member.role : null;
}

/**
 * Check if a user has a specific permission in a workspace
 * @param {Object} workspace
 * @param {string} userId
 * @param {string} permission
 * @returns {boolean}
 */
export function hasWorkspacePermission(workspace, userId, permission) {
  if (!workspace || !userId) return false;
  const member = workspace.members?.find((m) => m.userId === userId);
  if (!member) return false;

  const roleDef = DEFAULT_ROLES[member.role] || workspace.customRoles?.find((r) => r.id === member.role);
  if (!roleDef) return false;

  if (member.role === 'OWNER') return true;
  return roleDef.permissions.includes(permission);
}

/**
 * Get all permissions for a user in a workspace
 * @param {Object} workspace
 * @param {string} userId
 * @returns {string[]}
 */
export function getUserWorkspacePermissions(workspace, userId) {
  if (!workspace || !userId) return [];
  const member = workspace.members?.find((m) => m.userId === userId);
  if (!member) return [];

  if (member.role === 'OWNER') {
    return Object.values(DEFAULT_ROLES).reduce((acc, role) => {
      return [...acc, ...role.permissions];
    }, []);
  }

  const roleDef = DEFAULT_ROLES[member.role] || workspace.customRoles?.find((r) => r.id === member.role);
  return roleDef ? [...roleDef.permissions] : [];
}

/**
 * Check if a user can manage AI workflows
 * @param {string} role
 * @returns {boolean}
 */
export function canManageAIWorkflow(role) {
  return ['OWNER', 'VICE_ADMIN', 'MANAGER'].includes(role);
}

/**
 * Check if a user can access a specific team
 * @param {Object} team
 * @param {string} userId
 * @param {string} workspaceRole
 * @returns {boolean}
 */
export function canAccessTeam(team, userId, workspaceRole) {
  if (!team || !userId) return false;
  if (['OWNER', 'VICE_ADMIN', 'MANAGER'].includes(workspaceRole)) return true;
  return (team.memberIds || []).includes(userId);
}

/**
 * Get workspace-scoped role labels
 */
export const workspaceRoleLabels = {
  OWNER: 'Owner',
  VICE_ADMIN: 'Vice Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

export const workspaceRoleColors = {
  OWNER: 'bg-red-100 text-red-700',
  VICE_ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  EMPLOYEE: 'bg-green-100 text-green-700',
};
