/**
 * DynamoDB Meeting Repository — single-table implementation
 *
 * Access patterns:
 *   - Get meeting by ID: PK = MEETING#{id}, SK = META#{id}
 *   - List by workspace: GSI1PK = WS#{workspaceId}, GSI1SK = MEETING#{createdAt}
 *   - List by status:   GSI2PK = STATUS#{status}, GSI2SK = MEETING#{createdAt}
 *
 * @module dynamodb/repositories/meetingRepository
 */

import { getItem, putItem, updateItem, deleteItem, queryItems } from '../client.js';
import { ENTITY, pk, sk } from '../entityTypes.js';

/**
 * Build the full DynamoDB item for a meeting.
 *
 * @param {Object} meeting - Meeting data object
 * @returns {Object} DynamoDB record
 */
function toRecord(meeting) {
  const now = new Date().toISOString();
  return {
    PK: pk(ENTITY.MEETING, meeting.id),
    SK: sk('META', meeting.id),
    id: meeting.id,
    workspaceId: meeting.workspaceId,
    teamId: meeting.teamId || null,
    title: meeting.title,
    type: meeting.type || 'TRANSCRIPT',
    status: meeting.status || 'UPLOADED',
    fileName: meeting.fileName || null,
    storageKey: meeting.storageKey || null,
    transcriptText: meeting.transcriptText || '',
    aiSummary: meeting.aiSummary || '',
    summary: meeting.summary || '',
    keyDecisions: meeting.keyDecisions || [],
    actionItems: meeting.actionItems || [],
    risks: meeting.risks || [],
    suggestedTasks: meeting.suggestedTasks || [],
    generatedTaskIds: meeting.generatedTaskIds || [],
    createdBy: meeting.createdBy || null,
    // GSI1: lookup by workspace
    GSI1PK: `WS#${meeting.workspaceId}`,
    GSI1SK: `MEETING#${meeting.createdAt || now}`,
    // GSI2: lookup by status
    GSI2PK: `STATUS#${meeting.status || 'UPLOADED'}`,
    GSI2SK: `MEETING#${meeting.createdAt || now}`,
    version: meeting.version || 1,
    createdAt: meeting.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Convert a DynamoDB record back to a plain meeting object.
 *
 * @param {Object} record
 * @returns {Object|null}
 */
function fromRecord(record) {
  if (!record) return null;
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...meeting } = record;
  return meeting;
}

/**
 * Find a meeting by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(id) {
  const record = await getItem({
    PK: pk(ENTITY.MEETING, id),
    SK: sk('META', id),
  });
  return fromRecord(record);
}

/**
 * List meetings by workspace (via GSI1), newest first.
 * @param {string} workspaceId
 * @param {Object} [options]
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.limit=50]
 * @param {Object} [options.nextToken]
 * @returns {Promise<{items: Object[], nextToken: Object|null}>}
 */
export async function findByWorkspace(workspaceId, options = {}) {
  const { items, lastEvaluatedKey } = await queryItems({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `WS#${workspaceId}`,
    },
    Limit: options.limit || 50,
    ExclusiveStartKey: options.nextToken,
  });

  let meetings = items.map(fromRecord).filter(Boolean);

  if (options.status) {
    meetings = meetings.filter((m) => m.status === options.status);
  }

  return { items: meetings, nextToken: lastEvaluatedKey };
}

/**
 * List meetings by status (via GSI2).
 * @param {string} status
 * @param {Object} [options]
 * @returns {Promise<Object[]>}
 */
export async function findByStatus(status, options = {}) {
  const { items } = await queryItems({
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `STATUS#${status}`,
    },
    Limit: options.limit || 50,
  });
  return items.map(fromRecord).filter(Boolean);
}

/**
 * Create a new meeting.
 * @param {Object} meetingData
 * @returns {Promise<Object>}
 */
export async function create(meetingData) {
  const record = toRecord(meetingData);
  await putItem(record);
  return fromRecord(record);
}

/**
 * Update a meeting's fields.
 * @param {string} id
 * @param {Object} updates
 * @param {number} [expectedVersion]
 * @returns {Promise<Object|null>}
 */
export async function update(id, updates, expectedVersion) {
  const key = { PK: pk(ENTITY.MEETING, id), SK: sk('META', id) };

  // If status changed, update GSI2 keys
  if (updates.status) {
    const current = await findById(id);
    if (current && current.status !== updates.status) {
      updates.GSI2PK = `STATUS#${updates.status}`;
      updates.GSI2SK = `MEETING#${current.createdAt}`;
    }
  }

  updates.updatedAt = new Date().toISOString();

  const updated = await updateItem(key, updates, {
    expectedVersion,
  });
  return updated ? fromRecord(updated) : null;
}

/**
 * Delete a meeting.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function delete_(id) {
  await deleteItem({
    PK: pk(ENTITY.MEETING, id),
    SK: sk('META', id),
  });
}

export default { findById, findByWorkspace, findByStatus, create, update, delete_ };
