/**
 * DynamoDB Invitation Repository — single-table implementation
 *
 * Stores pending workspace invitations for users who haven't registered yet.
 * When a user registers, their email is checked against pending invitations.
 *
 * Access patterns:
 *   - Get invitation:       PK = INVITE#{workspaceId}, SK = INVITE#{inviteId}
 *   - List by workspace:    PK = INVITE#{workspaceId}, SK begins_with INVITE#
 *   - Find by email (GSI):  GSI1PK = EMAIL#{email}, GSI1SK begins_with INVITE#
 *
 * @module dynamodb/repositories/invitationRepository
 */

import { getItem, putItem, updateItem, queryItems, deleteItem } from '../client.js';
import { ENTITY, pk } from '../entityTypes.js';

/**
 * Generate a unique invitation ID.
 * @returns {string}
 */
function generateId() {
  return 'invite-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/**
 * Build the full DynamoDB item for an invitation.
 *
 * @param {Object} inv - Invitation data
 * @returns {Object} DynamoDB record
 */
function toRecord(inv) {
  const now = new Date().toISOString();
  return {
    PK: pk(ENTITY.INVITATION, inv.workspaceId),
    SK: `INVITE#${inv.id}`,
    id: inv.id,
    workspaceId: inv.workspaceId,
    workspaceName: inv.workspaceName || '',
    inviteeEmail: inv.inviteeEmail.toLowerCase().trim(),
    role: inv.role || 'EMPLOYEE',
    teamIds: Array.isArray(inv.teamIds) ? inv.teamIds : [],
    invitedBy: inv.invitedBy,
    invitedByUserName: inv.invitedByUserName || 'Unknown',
    status: inv.status || 'PENDING', // PENDING | ACCEPTED | DECLINED
    GSI1PK: `EMAIL#${(inv.inviteeEmail || '').toLowerCase().trim()}`,
    GSI1SK: `INVITE#${inv.id}`,
    createdAt: inv.createdAt || now,
    expiresAt: inv.expiresAt || undefined, // TTL (optional)
  };
}

/**
 * Convert a DynamoDB record back to a plain invitation object.
 *
 * @param {Object} record
 * @returns {Object|null}
 */
function fromRecord(record) {
  if (!record) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...inv } = record;
  return inv;
}

/**
 * Create a new invitation for a user (by email).
 * @param {Object} data - Invitation data
 * @returns {Promise<Object>} Created invitation
 */
export async function create(data) {
  const id = data.id || generateId();
  const record = toRecord({
    ...data,
    id,
  });

  await putItem(record);
  return fromRecord(record);
}

/**
 * Get a specific invitation by workspace and invitation ID.
 * @param {string} workspaceId
 * @param {string} inviteId
 * @returns {Promise<Object|null>}
 */
export async function findById(workspaceId, inviteId) {
  const record = await getItem({
    PK: pk(ENTITY.INVITATION, workspaceId),
    SK: `INVITE#${inviteId}`,
  });
  return fromRecord(record);
}

/**
 * List all invitations for a workspace.
 * @param {string} workspaceId
 * @param {Object} [options]
 * @param {string} [options.status] - Filter by status (PENDING, ACCEPTED, DECLINED)
 * @returns {Promise<Object[]>}
 */
export async function findByWorkspace(workspaceId, options = {}) {
  const { items } = await queryItems({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk(ENTITY.INVITATION, workspaceId),
      ':sk': 'INVITE#',
    },
    ScanIndexForward: false, // newest first
  });

  let invitations = items.map(fromRecord).filter(Boolean);

  if (options.status) {
    invitations = invitations.filter((i) => i.status === options.status);
  }

  return invitations;
}

/**
 * Find pending invitations by email (using GSI1).
 * Called when a user registers to process pending invitations.
 *
 * @param {string} email - User email
 * @returns {Promise<Object[]>} Pending invitations
 */
export async function findByEmail(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const { items } = await queryItems({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `EMAIL#${normalizedEmail}`,
      ':sk': 'INVITE#',
    },
  });

  return items.map(fromRecord).filter(Boolean);
}

/**
 * Update invitation status (e.g., when accepted or declined).
 * @param {string} workspaceId
 * @param {string} inviteId
 * @param {Object} updates - { status, ... }
 * @returns {Promise<Object>} Updated invitation
 */
export async function update(workspaceId, inviteId, updates) {
  const key = {
    PK: pk(ENTITY.INVITATION, workspaceId),
    SK: `INVITE#${inviteId}`,
  };
  const updated = await updateItem(key, updates);
  return fromRecord(updated);
}

/**
 * Delete an invitation.
 * @param {string} workspaceId
 * @param {string} inviteId
 * @returns {Promise<void>}
 */
export async function delete_(workspaceId, inviteId) {
  await deleteItem({
    PK: pk(ENTITY.INVITATION, workspaceId),
    SK: `INVITE#${inviteId}`,
  });
}

export default {
  create,
  findById,
  findByWorkspace,
  findByEmail,
  update,
  delete_,
};

/**
 * Get a specific invitation by workspace and invitation ID.
 * @param {string} workspaceId
 * @param {string} inviteId
 * @returns {Promise<Object|null>}
 */
export async function findById(workspaceId, inviteId) {
  const record = await getItem({
    PK: pk(ENTITY.INVITATION, workspaceId),
    SK: `INVITE#${inviteId}`,
  });
  return fromRecord(record);
}

/**
 * List all invitations for a workspace.
 * @param {string} workspaceId
 * @param {Object} [options]
 * @param {string} [options.status] - Filter by status (PENDING, ACCEPTED, DECLINED)
 * @returns {Promise<Object[]>}
 */
export async function findByWorkspace(workspaceId, options = {}) {
  const { items } = await queryItems({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk(ENTITY.INVITATION, workspaceId),
      ':sk': 'INVITE#',
    },
    ScanIndexForward: false, // newest first
  });

  let invitations = items.map(fromRecord).filter(Boolean);

  if (options.status) {
    invitations = invitations.filter((i) => i.status === options.status);
  }

  return invitations;
}

/**
 * Find pending invitations by email (using GSI1).
 * Called when a user registers to process pending invitations.
 *
 * @param {string} email - User email
 * @returns {Promise<Object[]>} Pending invitations
 */
export async function findByEmail(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const { items } = await queryItems({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `EMAIL#${normalizedEmail}`,
      ':sk': 'INVITE#',
    },
  });

  return items.map(fromRecord).filter(Boolean);
}

/**
 * Update invitation status (e.g., when accepted or declined).
 * @param {string} workspaceId
 * @param {string} inviteId
 * @param {Object} updates - { status, ... }
 * @returns {Promise<Object>} Updated invitation
 */
export async function update(workspaceId, inviteId, updates) {
  const key = {
    PK: pk(ENTITY.INVITATION, workspaceId),
    SK: `INVITE#${inviteId}`,
  };
  const updated = await updateItem(key, updates);
  return fromRecord(updated);
}

/**
 * Delete an invitation.
 * @param {string} workspaceId
 * @param {string} inviteId
 * @returns {Promise<void>}
 */
export async function delete_(workspaceId, inviteId) {
  await deleteItem({
    PK: pk(ENTITY.INVITATION, workspaceId),
    SK: `INVITE#${inviteId}`,
  });
}

export default {
  create,
  findById,
  findByWorkspace,
  findByEmail,
  update,
  delete_,
};
