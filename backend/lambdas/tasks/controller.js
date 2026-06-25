/**
 * Lambda Controller — Tasks
 *
 * Routes:
 *   GET    /tasks              — List tasks (role-scoped)
 *   POST   /tasks              — Create task
 *   GET    /tasks/{id}         — Get task details
 *   PATCH  /tasks/{id}         — Update task
 *   DELETE /tasks/{id}         — Delete task (admin only)
 *
 * @module lambdas/tasks/controller
 */

import * as db from '../../src/dynamodb/client.js';
import { ENTITY, pk, sk } from '../../src/dynamodb/entityTypes.js';
import { success, created, noContent, notFound, badRequest } from '../shared/router.js';

// ─── Helpers ──────────────────────────────────────────

function taskToRecord(task) {
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
    version: 1,
    createdAt: task.createdAt || now,
    updatedAt: now,
  };
}

function recordToTask(record) {
  if (!record) return null;
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...task } = record;
  return task;
}

// ─── Handlers ─────────────────────────────────────────

/**
 * GET /tasks — List tasks with filters.
 * Query params: workspaceId, status, assigneeId, meetingId, limit, nextToken
 */
export async function list(event) {
  const { authUser, queryStringParameters } = event;
  const q = queryStringParameters || {};
  const workspaceId = q.workspaceId || authUser.workspaceId;
  const status = q.status;
  const assigneeId = q.assigneeId;
  const meetingId = q.meetingId;
  const limit = Math.min(parseInt(q.limit || '50'), 100);
  const nextToken = q.nextToken ? JSON.parse(q.nextToken) : undefined;

  let items;

  // Role-based data access
  if (authUser.role === 'EMPLOYEE' && !assigneeId) {
    // Employees only see their own tasks
    const result = await db.queryItems({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `ASSIGNEE#${authUser.userId}` },
      Limit: limit,
      ExclusiveStartKey: nextToken,
    });
    items = result.items;
  } else if (assigneeId) {
    const result = await db.queryItems({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `ASSIGNEE#${assigneeId}` },
      Limit: limit,
      ExclusiveStartKey: nextToken,
    });
    items = result.items;
  } else if (workspaceId) {
    const result = await db.queryItems({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `WS#${workspaceId}` },
      Limit: limit,
      ExclusiveStartKey: nextToken,
    });
    items = result.items;
  } else {
    // Admin without filters: scan (use with caution)
    // In production, require at least one filter
    if (authUser.role === 'ADMIN') {
      const result = await db.queryItems({
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'METADATA' },
        Limit: limit,
      });
      items = result.items;
    } else {
      return success({ tasks: [], nextToken: null, count: 0 });
    }
  }

  let tasks = items.map(recordToTask).filter(Boolean);

  // Apply filters
  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }
  if (meetingId) {
    tasks = tasks.filter((t) => t.meetingId === meetingId || t.sourceMeetingId === meetingId);
  }

  return success({ tasks, count: tasks.length });
}

/**
 * POST /tasks — Create a new task.
 * Can be manual (manager/admin) or AI-generated.
 */
export async function create(event) {
  const { parsedBody, authUser } = event;

  if (!parsedBody.title || !parsedBody.workspaceId) {
    return badRequest('Title and workspaceId are required');
  }

  const now = new Date().toISOString();
  const task = taskToRecord({
    id: 'task-' + Date.now().toString(36),
    workspaceId: parsedBody.workspaceId,
    teamId: parsedBody.teamId,
    meetingId: parsedBody.meetingId || parsedBody.sourceMeetingId || null,
    sourceMeetingId: parsedBody.sourceMeetingId || parsedBody.meetingId || null,
    title: parsedBody.title.trim(),
    description: parsedBody.description || '',
    assigneeId: parsedBody.assigneeId || null,
    createdBy: authUser.userId,
    status: parsedBody.status || 'TODO',
    priority: parsedBody.priority || 'MEDIUM',
    progress: parsedBody.progress || 0,
    deadline: parsedBody.deadline || null,
    generatedFromAI: Boolean(parsedBody.generatedFromAI),
    aiConfidence: parsedBody.aiConfidence ?? null,
    createdAt: now,
  });

  await db.putItem(task);
  return created({ task: recordToTask(task) });
}

/**
 * GET /tasks/{id} — Get a single task.
 */
export async function get(event) {
  const { resourceId } = event;

  if (!resourceId) {
    return badRequest('Task ID is required');
  }

  const record = await db.getItem({
    PK: pk(ENTITY.TASK, resourceId),
    SK: sk('META', resourceId),
  });
  const task = recordToTask(record);

  if (!task) {
    return notFound('Task not found');
  }

  return success({ task });
}

/**
 * PATCH /tasks/{id} — Update a task.
 * Employees can only update status/progress.
 * Managers/Admins can update all fields.
 */
export async function update(event) {
  const { resourceId, parsedBody, authUser } = event;

  if (!resourceId) {
    return badRequest('Task ID is required');
  }

  const record = await db.getItem({
    PK: pk(ENTITY.TASK, resourceId),
    SK: sk('META', resourceId),
  });
  const current = recordToTask(record);

  if (!current) {
    return notFound('Task not found');
  }

  // Determine allowed fields based on role
  let allowedFields;

  if (authUser.role === 'EMPLOYEE') {
    allowedFields = ['status', 'progress', 'description'];
    // Employee can only update their own tasks
    if (current.assigneeId !== authUser.userId) {
      return badRequest('You can only update your own tasks', 'FORBIDDEN');
    }
  } else {
    allowedFields = [
      'title', 'description', 'status', 'priority', 'progress',
      'assigneeId', 'deadline', 'generatedFromAI', 'aiConfidence',
    ];
  }

  const updates = {};
  for (const field of allowedFields) {
    if (parsedBody[field] !== undefined) {
      updates[field] = parsedBody[field];
    }
  }

  // Auto-set progress for terminal statuses
  if (updates.status === 'COMPLETED' && current.status !== 'COMPLETED') {
    updates.progress = 100;
  }

  if (Object.keys(updates).length === 0) {
    return success({ task: current });
  }

  updates.updatedAt = new Date().toISOString();
  updates.version = (current.version || 1) + 1;

  // Update GSI2 keys if assignee or deadline changed
  if (updates.assigneeId !== undefined) {
    updates.GSI2PK = updates.assigneeId
      ? `ASSIGNEE#${updates.assigneeId}`
      : 'UNASSIGNED';
    updates.GSI2SK = current.deadline
      ? `DEADLINE#${current.deadline}`
      : 'NO_DEADLINE';
  }
  if (updates.deadline !== undefined) {
    updates.GSI2SK = updates.deadline
      ? `DEADLINE#${updates.deadline}`
      : 'NO_DEADLINE';
  }

  const key = { PK: pk(ENTITY.TASK, resourceId), SK: sk('META', resourceId) };
  const updated = await db.updateItem(key, updates);
  return success({ task: recordToTask(updated) });
}

/**
 * DELETE /tasks/{id} — Delete a task. Admin only.
 */
export async function deleteTask(event) {
  const { resourceId, authUser } = event;

  if (authUser.role !== 'ADMIN') {
    return badRequest('Only admins can delete tasks', 'FORBIDDEN');
  }

  await db.deleteItem({
    PK: pk(ENTITY.TASK, resourceId),
    SK: sk('META', resourceId),
  });

  return noContent();
}

export default { list, create, get, update, deleteTask };
