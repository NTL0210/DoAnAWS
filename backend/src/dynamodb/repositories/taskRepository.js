/**
 * DynamoDB Task Repository — single-table implementation
 *
 * Access patterns:
 *   - Get task by ID:       PK = TASK#{id}, SK = META#{id}
 *   - List by workspace:    GSI1PK = WS#{workspaceId}, GSI1SK = TASK#{createdAt}
 *   - List by assignee:     GSI2PK = ASSIGNEE#{userId}, GSI2SK = DEADLINE#{deadline}
 *   - List unassigned:      GSI2PK = UNASSIGNED, GSI2SK = NO_DEADLINE
 *
 * @module dynamodb/repositories/taskRepository
 */

import { getItem, putItem, updateItem, deleteItem, queryItems } from '../client.js';
import { ENTITY, pk, sk } from '../entityTypes.js';

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function isValidStatus(s) { return TASK_STATUSES.includes(s); }
function isValidPriority(p) { return PRIORITIES.includes(p); }

/**
 * Build the full DynamoDB item for a task.
 *
 * @param {Object} task - Task data object
 * @returns {Object} DynamoDB record
 */
function toRecord(task) {
  const now = new Date().toISOString();
  const taskId = task.id;
  return {
    PK: pk(ENTITY.TASK, taskId),
    SK: sk('META', taskId),
    id: taskId,
    workspaceId: task.workspaceId,
    teamId: task.teamId || null,
    meetingId: task.meetingId || null,
    sourceMeetingId: task.sourceMeetingId || task.meetingId || null,
    title: task.title,
    description: task.description || '',
    assigneeId: task.assigneeId || null,
    createdBy: task.createdBy || null,
    status: task.status || 'TODO',
    priority: task.priority || 'MEDIUM',
    progress: task.progress || 0,
    deadline: task.deadline || null,
    generatedFromAI: Boolean(task.generatedFromAI),
    aiConfidence: task.aiConfidence ?? null,
    // GSI1: tasks by workspace
    GSI1PK: `WS#${task.workspaceId}`,
    GSI1SK: `TASK#${task.createdAt || now}`,
    // GSI2: tasks by assignee
    GSI2PK: task.assigneeId ? `ASSIGNEE#${task.assigneeId}` : 'UNASSIGNED',
    GSI2SK: task.deadline ? `DEADLINE#${task.deadline}` : 'NO_DEADLINE',
    version: task.version || 1,
    createdAt: task.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Convert a DynamoDB record back to a plain task object.
 *
 * @param {Object} record
 * @returns {Object|null}
 */
function fromRecord(record) {
  if (!record) return null;
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...task } = record;
  return task;
}

/**
 * Find a task by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(id) {
  const record = await getItem({
    PK: pk(ENTITY.TASK, id),
    SK: sk('META', id),
  });
  return fromRecord(record);
}

/**
 * List tasks by workspace (via GSI1).
 * @param {string} workspaceId
 * @param {Object} [options]
 * @param {string} [options.status]
 * @param {string} [options.priority]
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

  let tasks = items.map(fromRecord).filter(Boolean);

  if (options.status) tasks = tasks.filter((t) => t.status === options.status);
  if (options.priority) tasks = tasks.filter((t) => t.priority === options.priority);

  return { items: tasks, nextToken: lastEvaluatedKey };
}

/**
 * List tasks assigned to a user (via GSI2).
 * @param {string} assigneeId
 * @param {Object} [options]
 * @returns {Promise<Object[]>}
 */
export async function findByAssignee(assigneeId, options = {}) {
  const { items } = await queryItems({
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `ASSIGNEE#${assigneeId}`,
    },
    Limit: options.limit || 100,
  });

  let tasks = items.map(fromRecord).filter(Boolean);

  if (options.status) tasks = tasks.filter((t) => t.status === options.status);

  return tasks;
}

/**
 * Find tasks related to a specific meeting.
 * @param {string} meetingId
 * @returns {Promise<Object[]>}
 */
export async function findByMeeting(meetingId) {
  // Scan-based lookup for MVP. In production, add a GSI for meeting→tasks.
  const { items } = await queryItems({
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'METADATA',
    },
  });
  return items.map(fromRecord).filter(Boolean).filter(
    (t) => t.meetingId === meetingId || t.sourceMeetingId === meetingId
  );
}

/**
 * Create a new task.
 * @param {Object} taskData
 * @returns {Promise<Object>}
 */
export async function create(taskData) {
  const record = toRecord(taskData);
  await putItem(record);
  return fromRecord(record);
}

/**
 * Update a task.
 * Employees can only update status/progress/description.
 * If assignee changes, GSI2 keys are updated.
 * If status is COMPLETED, progress auto-sets to 100.
 *
 * @param {string} id
 * @param {Object} updates
 * @param {number} [expectedVersion]
 * @returns {Promise<Object|null>}
 */
export async function update(id, updates, expectedVersion) {
  const key = { PK: pk(ENTITY.TASK, id), SK: sk('META', id) };
  const current = await findById(id);
  if (!current) return null;

  // Auto-set progress on COMPLETED
  if (updates.status === 'COMPLETED' && current.status !== 'COMPLETED') {
    updates.progress = 100;
  }

  // Update GSI2 keys if assignee or deadline changed
  if (updates.assigneeId !== undefined || (updates.deadline !== undefined && current.assigneeId)) {
    const newAssignee = updates.assigneeId ?? current.assigneeId;
    const newDeadline = updates.deadline ?? current.deadline;
    updates.GSI2PK = newAssignee ? `ASSIGNEE#${newAssignee}` : 'UNASSIGNED';
    updates.GSI2SK = newDeadline ? `DEADLINE#${newDeadline}` : 'NO_DEADLINE';
  }

  updates.updatedAt = new Date().toISOString();

  const updated = await updateItem(key, updates, { expectedVersion });
  return updated ? fromRecord(updated) : null;
}

/**
 * Delete a task.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function delete_(id) {
  await deleteItem({
    PK: pk(ENTITY.TASK, id),
    SK: sk('META', id),
  });
}

export default { findById, findByWorkspace, findByAssignee, findByMeeting, create, update, delete_ };
