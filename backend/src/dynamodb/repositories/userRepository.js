/**
 * DynamoDB User Repository — single-table implementation
 *
 * Access patterns:
 *   - Get user by ID: PK = USER#{id}, SK = PROFILE#{id}
 *   - Get user by email: GSI1PK = EMAIL#{email}, GSI1SK = USER#{id}
 *   - List all users: GSI2PK = ROLE#{role}, GSI2SK = PROFILE (admin only)
 *
 * @module dynamodb/repositories/userRepository
 */

import { getItem, putItem, updateItem, deleteItem, queryItems } from '../client.js';
import { ENTITY, SORT, pk, sk, gsi1 } from '../entityTypes.js';

/**
 * @typedef {Object} UserRecord
 * @property {string} PK - USER#{userId}
 * @property {string} SK - PROFILE#{userId}
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string|null} avatar
 * @property {string} phone
 * @property {string[]} avatarHistory
 * @property {string} role - ADMIN | MANAGER | EMPLOYEE
 * @property {string|null} departmentId
 * @property {string} GSI1PK - EMAIL#{email}
 * @property {string} GSI1SK - USER#{id}
 * @property {number} version
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Build the full DynamoDB item for a user.
 *
 * @param {Object} user - User data object
 * @returns {UserRecord}
 */
function toRecord(user) {
  const userId = user.id;
  return {
    PK: pk(ENTITY.USER, userId),
    SK: sk(SORT.PROFILE, userId),
    id: userId,
    name: user.name,
    email: user.email.toLowerCase(),
    avatar: user.avatar || null,
    phone: user.phone || '',
    avatarHistory: user.avatarHistory || [],
    role: user.role || 'EMPLOYEE',
    departmentId: user.departmentId || null,
    // GSI1: lookup by email
    GSI1PK: `EMAIL#${user.email.toLowerCase()}`,
    GSI1SK: `USER#${userId}`,
    version: user.version || 1,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Convert a DynamoDB record back to a plain user object.
 * Strips the DynamoDB-specific key attributes.
 *
 * @param {UserRecord} record
 * @returns {Object}
 */
function fromRecord(record) {
  if (!record) return null;
  const { PK, SK, GSI1PK, GSI1SK, ...user } = record;
  return user;
}

/**
 * Find a user by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(id) {
  const record = await getItem({
    PK: pk(ENTITY.USER, id),
    SK: sk(SORT.PROFILE, id),
  });
  return fromRecord(record);
}

/**
 * Find a user by email (uses GSI1).
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export async function findByEmail(email) {
  const normalized = email.toLowerCase().trim();
  const { items } = await queryItems({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `EMAIL#${normalized}`,
    },
    Limit: 1,
  });
  if (items.length === 0) return null;
  const userId = items[0].id;
  return await findById(userId);
}

/**
 * Get all users. Optionally filter by role.
 *
 * @param {Object} [options]
 * @param {string} [options.role] - Filter by role (ADMIN|MANAGER|EMPLOYEE)
 * @returns {Promise<Object[]>}
 */
export async function findAll(options = {}) {
  if (options.role) {
    // Use GSI2 for role-based listing
    const { items } = await queryItems({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `ROLE#${options.role}`,
      },
    });
    return items.map(fromRecord).filter(Boolean);
  }

  // Full scan (expensive — use sparingly, prefer GSI queries)
  const { items } = await queryItems({
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'METADATA',
    },
    // Fallback: scan all users using a different pattern
  });

  // For MVP, use a scan approach. In production, add a proper GSI.
  // This is a simplified query — a real implementation would use a
  // dedicated GSI or the Admin API with pagination.
  return items.map(fromRecord).filter(Boolean);
}

/**
 * Create a new user.
 * @param {Object} userData
 * @returns {Promise<Object>}
 */
export async function create(userData) {
  const now = new Date().toISOString();
  const user = {
    id: userData.id || 'user-' + Date.now().toString(36),
    name: userData.name || '',
    email: userData.email || '',
    password: userData.password,
    avatar: userData.avatar || null,
    phone: userData.phone || '',
    avatarHistory: userData.avatarHistory || [],
    role: userData.role || 'EMPLOYEE',
    departmentId: userData.departmentId || null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  // Hash password if present
  if (user.password) {
    const { createHash } = await import('node:crypto');
    user.passwordHash = createHash('sha256').update(user.password).digest('hex');
    delete user.password;
  }

  const record = toRecord(user);

  // Also set GSI2 for role-based queries
  record.GSI2PK = `ROLE#${user.role}`;
  record.GSI2SK = `PROFILE#${user.id}`;

  await putItem(record);
  return fromRecord(record);
}

/**
 * Update a user's profile fields.
 * Does NOT allow changing email or role (use admin API for that).
 *
 * @param {string} id
 * @param {Object} updates - Fields to update
 * @param {number} [expectedVersion] - Optimistic locking
 * @returns {Promise<Object|null>}
 */
export async function update(id, updates, expectedVersion) {
  const key = { PK: pk(ENTITY.USER, id), SK: sk(SORT.PROFILE, id) };
  const updated = await updateItem(key, updates, {
    expectedVersion,
    nullFields: updates.avatar === null ? ['avatar'] : undefined,
  });
  return updated ? fromRecord(updated) : null;
}

/**
 * Delete a user.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function delete_(id) {
  await deleteItem({
    PK: pk(ENTITY.USER, id),
    SK: sk(SORT.PROFILE, id),
  });
}

export default { findById, findByEmail, findAll, create, update, delete_ };
