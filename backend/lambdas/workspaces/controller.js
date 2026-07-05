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
  create as createWorkspace,
  update as updateWorkspace,
  delete_ as deleteWorkspace,
} from '../../src/dynamodb/repositories/workspaceRepository.js';
import { success, created, noContent, notFound, badRequest } from '../shared/router.js';

function canAccessWorkspace(workspace, authUser) {
  if (!workspace || !authUser) return false;
  return workspace.ownerId === authUser.userId || authUser.role === 'ADMIN';
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
  if (!canAccessWorkspace(workspace, authUser)) {
    return badRequest('You do not have access to this workspace', 'FORBIDDEN');
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
  if (!canAccessWorkspace(current, authUser)) {
    return badRequest('You do not have access to this workspace', 'FORBIDDEN');
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
    return badRequest('Only the workspace owner can delete this workspace', 'FORBIDDEN');
  }

  await deleteWorkspace(resourceId);
  return noContent();
}

export default { list, create, get, update, delete_ };