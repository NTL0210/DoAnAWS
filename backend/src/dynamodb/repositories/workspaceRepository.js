/**
 * DynamoDB Workspace Repository — single-table implementation
 *
 * Access patterns:
 *   - Get workspace:        PK = WS#{id}, SK = META#{id}
 *   - List workspace members: PK = WS#{id}, SK begins_with MEMBER#
 *   - List by owner:        GSI1PK = OWNER#{ownerId}, GSI1SK = WS#{createdAt}
 *
 * @module dynamodb/repositories/workspaceRepository
 */

import { getItem, putItem, updateItem, deleteItem, queryItems } from '../client.js';
import { ENTITY, pk, sk } from '../entityTypes.js';

/**
 * Build the full DynamoDB item for a workspace.
 *
 * @param {Object} ws - Workspace data object
 * @returns {Object} DynamoDB record
 */
function toRecord(ws) {
  const now = new Date().toISOString();
  return {
    PK: pk(ENTITY.WORKSPACE, ws.id),
    SK: sk('META', ws.id),
    id: ws.id,
    name: ws.name,
    slug: ws.slug || ws.name?.toLowerCase().replace(/\s+/g, '-'),
    description: ws.description || '',
    ownerId: ws.ownerId,
    // GSI1: lookup workspaces by owner
    GSI1PK: `OWNER#${ws.ownerId}`,
    GSI1SK: `WS#${ws.createdAt || now}`,
    version: ws.version || 1,
    createdAt: ws.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Convert a DynamoDB record back to a plain workspace object.
 *
 * @param {Object} record
 * @returns {Object|null}
 */
function fromRecord(record) {
  if (!record) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...ws } = record;
  return ws;
}

/**
 * Build a member record within a workspace.
 *
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} role - OWNER | VICE_ADMIN | MANAGER | EMPLOYEE
 * @returns {Object} DynamoDB member record
 */
function memberRecord(workspaceId, userId, role = 'EMPLOYEE') {
  const now = new Date().toISOString();
  return {
    PK: pk(ENTITY.WORKSPACE, workspaceId),
    SK: sk('MEMBER', userId),
    workspaceId,
    userId,
    role,
    joinedAt: now,
  };
}

/**
 * Find a workspace by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(id) {
  const record = await getItem({
    PK: pk(ENTITY.WORKSPACE, id),
    SK: sk('META', id),
  });
  return fromRecord(record);
}

/**
 * Find workspaces owned by a user (via GSI1).
 * @param {string} ownerId
 * @returns {Promise<Object[]>}
 */
export async function findByOwner(ownerId) {
  const { items } = await queryItems({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `OWNER#${ownerId}`,
    },
  });
  return items.map(fromRecord).filter(Boolean);
}

/**
 * Get all members of a workspace.
 * @param {string} workspaceId
 * @returns {Promise<Object[]>}
 */
export async function getMembers(workspaceId) {
  const { items } = await queryItems({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk(ENTITY.WORKSPACE, workspaceId),
      ':sk': 'MEMBER#',
    },
  });
  return items;
}

/**
 * Add a member to a workspace.
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} role
 * @returns {Promise<Object>}
 */
export async function addMember(workspaceId, userId, role = 'EMPLOYEE') {
  const record = memberRecord(workspaceId, userId, role);
  await putItem(record);
  return record;
}

/**
 * Remove a member from a workspace.
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function removeMember(workspaceId, userId) {
  await deleteItem({
    PK: pk(ENTITY.WORKSPACE, workspaceId),
    SK: sk('MEMBER', userId),
  });
}

/**
 * Create a new workspace.
 * Also adds the owner as a member with role OWNER.
 *
 * @param {Object} wsData
 * @returns {Promise<Object>}
 */
export async function create(wsData) {
  const now = new Date().toISOString();
  const ws = {
    id: wsData.id || 'ws-' + Date.now().toString(36),
    name: wsData.name || 'Untitled Workspace',
    slug: wsData.slug,
    description: wsData.description || '',
    ownerId: wsData.ownerId,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const record = toRecord(ws);
  await putItem(record);

  // Add owner as member with OWNER role
  await addMember(ws.id, ws.ownerId, 'OWNER');

  return fromRecord(record);
}

/**
 * Update a workspace.
 * @param {string} id
 * @param {Object} updates
 * @param {number} [expectedVersion]
 * @returns {Promise<Object|null>}
 */
export async function update(id, updates, expectedVersion) {
  const key = { PK: pk(ENTITY.WORKSPACE, id), SK: sk('META', id) };
  updates.updatedAt = new Date().toISOString();
  const updated = await updateItem(key, updates, { expectedVersion });
  return updated ? fromRecord(updated) : null;
}

/**
 * Delete a workspace and all its members.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function delete_(id) {
  // Remove all members first
  const members = await getMembers(id);
  for (const member of members) {
    await deleteItem({
      PK: pk(ENTITY.WORKSPACE, id),
      SK: sk('MEMBER', member.userId),
    });
  }

  // Remove workspace metadata
  await deleteItem({
    PK: pk(ENTITY.WORKSPACE, id),
    SK: sk('META', id),
  });
}

export default { findById, findByOwner, getMembers, addMember, removeMember, create, update, delete_ };
