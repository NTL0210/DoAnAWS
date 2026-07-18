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
import { findById as findWorkspaceById, getMembers } from '../../src/dynamodb/repositories/workspaceRepository.js';
import { success, created, noContent, notFound, badRequest, error } from '../shared/router.js';

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
    status: task.status || 'PENDING',
    priority: task.priority || 'MEDIUM',
    progress: task.progress || 0,
    startDate: task.startDate || null,
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
  if (isIncompleteAfterDeadline(task)) {
    return { ...task, status: 'OVERDUE', progress: Math.min(task.progress || 0, 99) };
  }
  return task;
}

function hasInvalidDateRange(startDate, deadline) {
  return Boolean(startDate && deadline && startDate > deadline);
}

function isIncompleteAfterDeadline(task, now = new Date()) {
  if (!task?.deadline) return false;
  if (['COMPLETED', 'REVIEW', 'CANCELLED'].includes(task.status)) return false;
  const deadlineDate = new Date(task.deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;
  return deadlineDate < now;
}

async function getWorkspaceRole(workspaceId, authUser) {
  if (authUser?.role === 'ADMIN') return 'ADMIN';
  const [workspace, members] = await Promise.all([
    findWorkspaceById(workspaceId),
    getMembers(workspaceId),
  ]);
  if (workspace?.ownerId === authUser?.userId) return 'OWNER';
  return members.find((member) => member.userId === authUser?.userId)?.role || null;
}

function isPrivilegedReviewer(workspaceRole) {
  return ['ADMIN', 'OWNER', 'VICE_ADMIN'].includes(workspaceRole);
}

function forbidden(message) {
  return error(403, 'FORBIDDEN', message);
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
  const workspaceRole = workspaceId
    ? await getWorkspaceRole(workspaceId, authUser)
    : authUser.role;
  const canViewWorkspaceTasks = ['ADMIN', 'OWNER', 'VICE_ADMIN', 'MANAGER'].includes(workspaceRole);

  let items;

  // Role-based data access
  if (!canViewWorkspaceTasks) {
    if (assigneeId && assigneeId !== authUser.userId) {
      return forbidden('You can only view your own tasks.');
    }
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
  if (hasInvalidDateRange(parsedBody.startDate, parsedBody.deadline)) {
    return badRequest('Start date cannot be after the deadline');
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
    status: parsedBody.status || 'PENDING',
    priority: parsedBody.priority || 'MEDIUM',
    progress: parsedBody.progress || 0,
    startDate: parsedBody.startDate || null,
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
  const taskIsPastDeadline = isIncompleteAfterDeadline(record);

  if (!current) {
    return notFound('Task not found');
  }
  if (hasInvalidDateRange(parsedBody.startDate ?? current.startDate, parsedBody.deadline ?? current.deadline)) {
    return badRequest('Start date cannot be after the deadline');
  }

  const workspaceRole = await getWorkspaceRole(current.workspaceId, authUser);
  const isAssignee = current.assigneeId && current.assigneeId === authUser.userId;
  const isReviewer = isPrivilegedReviewer(workspaceRole);
  const canManageTask = isReviewer || workspaceRole === 'MANAGER';

  if (!isAssignee && !canManageTask) {
    return forbidden('Only the assigned user can update this task.');
  }

  const requestedStatus = parsedBody.status;
  if (requestedStatus !== undefined) {
    const allowedStatuses = ['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED', 'OVERDUE'];
    if (!allowedStatuses.includes(requestedStatus)) {
      return badRequest('Invalid task status');
    }
    if (isAssignee) {
      const isStarting = current.status === 'PENDING' && requestedStatus === 'IN_PROGRESS';
      const isSubmitting = ['IN_PROGRESS', 'OVERDUE'].includes(current.status) && requestedStatus === 'REVIEW';
      if (!isStarting && !isSubmitting) {
        return forbidden('Assigned users can only start a pending task or send active work to review.');
      }
    } else if (isReviewer) {
      if (!(current.status === 'REVIEW' && requestedStatus === 'COMPLETED')) {
        return forbidden('Owner and vice admin can only complete tasks that are ready for review.');
      }
    } else {
      return forbidden('Managers cannot receive or complete tasks for the assignee.');
    }
  }

  const allowedFields = canManageTask && !isAssignee
    ? [
      'title', 'description', 'status', 'priority', 'progress',
      'assigneeId', 'startDate', 'deadline', 'generatedFromAI', 'aiConfidence',
    ]
    : ['status', 'progress', 'description'];

  const updates = {};
  for (const field of allowedFields) {
    if (parsedBody[field] !== undefined) {
      updates[field] = parsedBody[field];
    }
  }

  if (taskIsPastDeadline && updates.status !== 'REVIEW') {
    updates.status = 'OVERDUE';
    updates.progress = Math.min(updates.progress ?? current.progress ?? 0, 99);
  }

  if (updates.status === 'IN_PROGRESS' && current.status !== 'IN_PROGRESS') {
    updates.progress = Math.max(current.progress || 0, 1);
  }

  if (updates.status === 'REVIEW') {
    updates.progress = 100;
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
