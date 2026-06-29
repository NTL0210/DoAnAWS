/**
 * Lambda Controller — Meetings
 *
 * Routes:
 *   GET    /meetings              — List meetings (role-scoped)
 *   POST   /meetings              — Upload/create meeting
 *   GET    /meetings/{id}         — Get meeting details
 *   PATCH  /meetings/{id}         — Update meeting metadata
 *   POST   /meetings/{id}/process — Trigger AI processing (Step Functions)
 *
 * @module lambdas/meetings/controller
 */

import * as db from '../../src/dynamodb/client.js';
import { ENTITY, pk, sk, gsi1 } from '../../src/dynamodb/entityTypes.js';
import { success, created, noContent, notFound, badRequest } from '../shared/router.js';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const TABLE_NAME = db.getTableName();
const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

// ─── Helpers ──────────────────────────────────────────

function meetingToRecord(meeting) {
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
    GSI1SK: `MEETING#${meeting.createdAt || new Date().toISOString()}`,
    // GSI2: lookup by status
    GSI2PK: `STATUS#${meeting.status}`,
    GSI2SK: `MEETING#${meeting.createdAt || new Date().toISOString()}`,
    version: 1,
    createdAt: meeting.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function recordToMeeting(record) {
  if (!record) return null;
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...meeting } = record;
  return meeting;
}

// ─── Handlers ─────────────────────────────────────────

/**
 * GET /meetings — List meetings with role-based scoping.
 * Query params: workspaceId, status, limit, nextToken
 */
export async function list(event) {
  const { authUser, queryStringParameters } = event;
  const q = queryStringParameters || {};
  const workspaceId = q.workspaceId || authUser.workspaceId;
  const status = q.status;
  const limit = Math.min(parseInt(q.limit || '50'), 100);
  const nextToken = q.nextToken ? JSON.parse(q.nextToken) : undefined;

  let items;

  if (authUser.role === 'ADMIN' && !workspaceId) {
    // Admin without workspace filter: scan (use with caution)
    const result = await db.queryItems({
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'METADATA' },
      Limit: limit,
      ExclusiveStartKey: nextToken,
    });
    items = result.items;
  } else if (workspaceId) {
    // Query by workspace via GSI1
    const result = await db.queryItems({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `WS#${workspaceId}` },
      Limit: limit,
      ExclusiveStartKey: nextToken,
    });
    items = result.items;
  } else {
    return success({ meetings: [], nextToken: null });
  }

  let meetings = items.map(recordToMeeting);

  // Filter by status
  if (status) {
    meetings = meetings.filter((m) => m.status === status);
  }

  return success({ meetings, count: meetings.length });
}

/**
 * POST /meetings — Create a new meeting record.
 */
export async function create(event) {
  const { parsedBody, authUser } = event;

  if (!parsedBody.title || !parsedBody.workspaceId) {
    return badRequest('Title and workspaceId are required');
  }

  if (authUser.role === 'EMPLOYEE') {
    return badRequest('Employees cannot create meetings', 'FORBIDDEN');
  }

  const now = new Date().toISOString();
  const meeting = meetingToRecord({
    id: 'meeting-' + Date.now().toString(36),
    workspaceId: parsedBody.workspaceId,
    teamId: parsedBody.teamId,
    title: parsedBody.title.trim(),
    type: parsedBody.type || 'TRANSCRIPT',
    status: 'UPLOADED',
    fileName: parsedBody.fileName || null,
    storageKey: parsedBody.storageKey || null,
    transcriptText: parsedBody.transcriptText || '',
    createdBy: authUser.userId,
    createdAt: now,
  });

  await db.putItem(meeting);
  return created({ meeting: recordToMeeting(meeting) });
}

/**
 * GET /meetings/{id} — Get meeting details.
 */
export async function get(event) {
  const { resourceId } = event;

  if (!resourceId) {
    return badRequest('Meeting ID is required');
  }

  const record = await db.getItem({
    PK: pk(ENTITY.MEETING, resourceId),
    SK: sk('META', resourceId),
  });
  const meeting = recordToMeeting(record);

  if (!meeting) {
    return notFound('Meeting not found');
  }

  return success({ meeting });
}

/**
 * PATCH /meetings/{id} — Update meeting metadata.
 */
export async function update(event) {
  const { resourceId, parsedBody, authUser } = event;

  if (!resourceId) {
    return badRequest('Meeting ID is required');
  }

  // Fetch current to check existence and version
  const record = await db.getItem({
    PK: pk(ENTITY.MEETING, resourceId),
    SK: sk('META', resourceId),
  });
  const current = recordToMeeting(record);

  if (!current) {
    return notFound('Meeting not found');
  }

  // Permission: only creator, manager, or admin can update
  if (authUser.role === 'EMPLOYEE' && current.createdBy !== authUser.userId) {
    return badRequest('You can only update meetings you created', 'FORBIDDEN');
  }

  const allowedFields = ['title', 'status', 'summary', 'aiSummary', 'transcriptText',
    'keyDecisions', 'actionItems', 'risks', 'suggestedTasks', 'generatedTaskIds'];

  const updates = {};
  for (const field of allowedFields) {
    if (parsedBody[field] !== undefined) {
      updates[field] = parsedBody[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return success({ meeting: current });
  }

  updates.updatedAt = new Date().toISOString();
  updates.version = (current.version || 1) + 1;

  // If status changed, update GSI2
  if (updates.status && updates.status !== current.status) {
    // We need to delete old GSI2 and add new one
    // For simplicity, set the new GSI2 values
    updates.GSI2PK = `STATUS#${updates.status}`;
    updates.GSI2SK = `MEETING#${current.createdAt}`;
  }

  const key = { PK: pk(ENTITY.MEETING, resourceId), SK: sk('META', resourceId) };
  const updated = await db.updateItem(key, updates);
  return success({ meeting: recordToMeeting(updated) });
}

/**
 * DELETE /meetings/{id} — Delete a meeting. Admin only.
 */
export async function deleteMeeting(event) {
  const { resourceId, authUser } = event;

  if (authUser.role !== 'ADMIN') {
    return badRequest('Only admins can delete meetings', 'FORBIDDEN');
  }

  await db.deleteItem({
    PK: pk(ENTITY.MEETING, resourceId),
    SK: sk('META', resourceId),
  });

  return noContent();
}

/**
 * POST /meetings/{id}/process — Trigger AI processing.
 */
export async function postProcess(event) {
  const { resourceId, authUser } = event;

  if (!resourceId) {
    return badRequest('Meeting ID is required');
  }

  if (authUser.role === 'EMPLOYEE') {
    return badRequest('Only managers and admins can process meetings', 'FORBIDDEN');
  }

  // Fetch meeting
  const record = await db.getItem({
    PK: pk(ENTITY.MEETING, resourceId),
    SK: sk('META', resourceId),
  });
  const meeting = recordToMeeting(record);

  if (!meeting) {
    return notFound('Meeting not found');
  }

  if (meeting.status !== 'UPLOADED') {
    return badRequest('Meeting has already been processed or is currently processing', 'CONFLICT');
  }

  // Update status to PROCESSING
  const key = { PK: pk(ENTITY.MEETING, resourceId), SK: sk('META', resourceId) };
  await db.updateItem(key, {
    status: 'PROCESSING',
    updatedAt: new Date().toISOString(),
    GSI2PK: 'STATUS#PROCESSING',
    GSI2SK: `MEETING#${meeting.createdAt}`,
  });

  // Invoke ai-processing Lambda for summarization + task extraction
  const AI_PROCESSING_FN = process.env.AI_PROCESSING_FUNCTION_NAME || 'ai-meeting-processing';

  const payload = {
    action: 'summarize',
    meetingId: resourceId,
    transcript: meeting.transcriptText || '',
    storageKey: meeting.storageKey,
    bucket: meeting.bucket || process.env.AUDIO_BUCKET,
  };

  // Fire-and-forget: invoke async, don't wait for result
  lambda.send(new InvokeCommand({
    FunctionName: AI_PROCESSING_FN,
    InvocationType: 'Event',
    Payload: new TextEncoder().encode(JSON.stringify(payload)),
  })).catch((err) => {
    console.error(`[Meetings] Failed to invoke AI processing for ${resourceId}:`, err);
    // Don't throw — processing can be retried later
  });

  return success({
    meetingId: resourceId,
    status: 'PROCESSING',
    message: 'AI processing started. The meeting will be updated when analysis completes.',
  }, 202);
}

export default { list, create, get, update, deleteMeeting, uploadTranscript, postProcess, POST_process: postProcess, POST_transcript: uploadTranscript };

/**
 * POST /meetings/{id}/transcript — Upload transcript text for a meeting.
 *
 * Used after local ASR processing (e.g. Sherpa Vietnamese ASR).
 * Sets meeting status back to UPLOADED so postProcess can be called.
 */
export async function uploadTranscript(event) {
  const { resourceId, parsedBody, authUser } = event;

  if (!resourceId) {
    return badRequest('Meeting ID is required');
  }

  if (!parsedBody || !parsedBody.transcriptText) {
    return badRequest('transcriptText is required');
  }

  if (authUser.role === 'EMPLOYEE') {
    return badRequest('Only managers and admins can update transcripts', 'FORBIDDEN');
  }

  const record = await db.getItem({
    PK: pk(ENTITY.MEETING, resourceId),
    SK: sk('META', resourceId),
  });
  const meeting = recordToMeeting(record);

  if (!meeting) {
    return notFound('Meeting not found');
  }

  const now = new Date().toISOString();
  const key = { PK: pk(ENTITY.MEETING, resourceId), SK: sk('META', resourceId) };
  const updated = await db.updateItem(key, {
    transcriptText: parsedBody.transcriptText,
    status: 'UPLOADED',
    updatedAt: now,
    version: (meeting.version || 1) + 1,
    GSI2PK: 'STATUS#UPLOADED',
    GSI2SK: `MEETING#${meeting.createdAt}`,
  });

  return success({
    meeting: recordToMeeting(updated),
    message: 'Transcript uploaded. Call POST /meetings/{id}/process to start AI analysis.',
  });
}
