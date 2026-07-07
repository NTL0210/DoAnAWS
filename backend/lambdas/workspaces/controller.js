/**
 * Lambda Controller - Workspaces
 *
 * Routes:
 *   GET    /workspaces          - List workspaces owned by the authenticated user
 *   POST   /workspaces          - Create workspace for the authenticated user
 *   GET    /workspaces/{id}     - Get workspace details
 *   PATCH  /workspaces/{id}     - Update workspace
 *   DELETE /workspaces/{id}     - Delete workspace
 */

import {
  findById,
  findByOwner,
  getMembers,
  create as createWorkspace,
  update as updateWorkspace,
  delete_ as deleteWorkspace,
} from '../../src/dynamodb/repositories/workspaceRepository.js';
import { success, created, noContent, notFound, badRequest, error } from '../shared/router.js';

/** Role hierarchy (higher = more permissions) */
const ROLE_HIERARCHY = { OWNER: 5, ADMIN: 4, VICE_ADMIN: 3, MANAGER: 2, MEMBER: 1, EMPLOYEE: 0 };

function getMemberRole(members, userId) {
  const member = members.find((m) => m.userId === userId);
  return member ? member.role : null;
}

function hasMinRole(userRole, minRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

/**
 * Check workspace-level access.
 * @param {Object} workspace
 * @param {Object[]} members - workspace member records
 * @param {Object} authUser - authenticated user
 * @param {string} minRole - minimum role required (default: 'MEMBER')
 */
function canAccessWorkspace(workspace, members, authUser, minRole = 'MEMBER') {
  if (!workspace || !authUser) return false;
  // System admin bypass
  if (authUser.role === 'ADMIN') return true;
  // Workspace owner always has access
  if (workspace.ownerId === authUser.userId) return true;
  // Check workspace membership role
  const userRole = getMemberRole(members, authUser.userId);
  if (!userRole) return false;
  return hasMinRole(userRole, minRole);
}

export async function list(event) {
  const { authUser } = event;
  const workspaces = await findByOwner(authUser.userId);
  return success(workspaces);
}

export async function create(event) {
  const { parsedBody, authUser } = event;
  const name = parsedBody?.name?.trim();

  if (!name) {
    return badRequest('Workspace name is required');
  }

  const workspace = await createWorkspace({
    name,
    description: parsedBody.description || '',
    ownerId: authUser.userId,
    slug: parsedBody.slug,
    iconColor: parsedBody.iconColor || 'blue',
    workspaceType: parsedBody.workspaceType || 'blank',
    visibility: parsedBody.visibility || 'private',
  });

  return created(workspace);
}

export async function get(event) {
  const { resourceId, authUser } = event;
  if (!resourceId) {
    return badRequest('Workspace ID is required');
  }

  const workspace = await findById(resourceId);
  if (!workspace) {
    return notFound('Workspace not found');
  }
  const members = await getMembers(resourceId);
  if (!canAccessWorkspace(workspace, members, authUser, 'MEMBER')) {
    return error(403, 'FORBIDDEN', 'You do not have access to this workspace');
  }

  return success(workspace);
}

export async function update(event) {
  const { resourceId, parsedBody, authUser } = event;
  if (!resourceId) {
    return badRequest('Workspace ID is required');
  }

  const current = await findById(resourceId);
  if (!current) {
    return notFound('Workspace not found');
  }
  const members = await getMembers(resourceId);
  // MEMBER + can update non-critical fields; OWNER/ADMIN can update everything
  if (!canAccessWorkspace(current, members, authUser, 'MEMBER')) {
    return error(403, 'FORBIDDEN', 'You do not have access to this workspace');
  }

  const allowedFields = [
    'name',
    'description',
    'iconColor',
    'workspaceType',
    'visibility',
    'channels',
    'teams',
    'members',
    'messages',
    'voiceRecords',
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (parsedBody[field] !== undefined) {
      updates[field] = parsedBody[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return success(current);
  }

  // Restrict sensitive fields for non-owner members
  const userRole = getMemberRole(members, authUser.userId);
  const isOwnerOrAdmin = current.ownerId === authUser.userId || authUser.role === 'ADMIN';
  if (!isOwnerOrAdmin && userRole !== 'OWNER' && userRole !== 'ADMIN') {
    // Only owner/admin can change workspace type or visibility
    delete updates.workspaceType;
    delete updates.visibility;
    delete updates.members;
  }

  const updated = await updateWorkspace(resourceId, updates, parsedBody.expectedVersion || current.version || 1);
  if (!updated) {
    return badRequest('Failed to update workspace', 'CONFLICT');
  }

  return success(updated);
}

export async function delete_(event) {
  const { resourceId, authUser } = event;
  if (!resourceId) {
    return badRequest('Workspace ID is required');
  }

  const workspace = await findById(resourceId);
  if (!workspace) {
    return notFound('Workspace not found');
  }
  if (workspace.ownerId !== authUser.userId && authUser.role !== 'ADMIN') {
    return error(403, 'FORBIDDEN', 'Only the workspace owner can delete this workspace');
  }

  await deleteWorkspace(resourceId);
  return noContent();
}

export default { list, create, get, update, delete_ };