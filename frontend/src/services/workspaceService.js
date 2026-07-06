/**
 * WorkspaceService - workspace helpers backed by API Gateway and Cognito.
 */

export { canManageAIWorkflow } from './permissionService';
export { getDefaultPermissionsForRole } from '@/data/defaults/roles';

import { workspacesApi } from '@/services/cloudClient';

/**
 * Generate a URL-friendly slug from a workspace name
 * @param {string} name
 * @returns {string}
 */
export function generateWorkspaceSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace';
}

/**
 * Generate a unique ID
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Find all workspaces for a user
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function getWorkspacesForUser(userId) {
  return workspacesApi.list({ userId });
}

/**
 * Find workspace by ID
 * @param {string} workspaceId
 * @returns {Promise<Object|null>}
 */
export async function getWorkspaceById(workspaceId) {
  return workspacesApi.get(workspaceId);
}

/**
 * Create a new workspace and persist
 * @param {Object} param0
 * @param {string} param0.name
 * @param {string} param0.ownerId
 * @returns {Promise<Object>}
 */
export async function createWorkspace({
  name,
  ownerId,
  description,
  workspaceType,
  visibility,
  iconColor,
}) {
  return workspacesApi.create({
    name,
    ownerId,
    description,
    workspaceType,
    visibility,
    iconColor,
  });
}
