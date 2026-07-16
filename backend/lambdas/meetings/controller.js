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
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import * as inviteService from './inviteService.js';

const TABLE_NAME = db.getTableName();
const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const sfn = new SFNClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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

// ─── Gemini AI helper ──────────────────────────────────

const SYSTEM_PROMPT_ANALYZE = `Bạn là trợ lý phân tích cuộc họp chuyên nghiệp.

Dựa vào transcript cuộc họp dưới đây, hãy phân tích và trả về:
1. Tóm tắt ngắn gọn bằng tiếng Việt (summary)
2. Các quyết định quan trọng (keyDecisions)
3. Danh sách công việc cần làm (tasks) — mỗi task có title, description, assignee (nếu có), priority (HIGH/MEDIUM/LOW), deadline (nếu có)
4. Các rủi ro / vấn đề cần theo dõi (risks)

CHỈ trả về JSON, không thêm chữ nào khác:
{
  "summary": "...",
  "keyDecisions": ["...", "..."],
  "tasks": [
    {
      "title": "Tên công việc",
      "description": "Mô tả chi tiết",
      "assignee": "Tên người được giao (nếu có)",
      "priority": "HIGH|MEDIUM|LOW",
      "deadline": "YYYY-MM-DD (nếu có)"
    }
  ],
  "risks": ["...", "..."]
}

Nguyên tắc:
- Chỉ lấy thông tin được đề cập rõ ràng trong transcript
- Nếu không có ai được giao, để assignee là rỗng
- Nếu không có deadline, để deadline là rỗng
- Tóm tắt ngắn gọn, đủ ý chính`;

/**
 * Extract JSON from Gemini response text (handles markdown code fences).
 */
function extractJson(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: try to find an array or object in the text
    const match = cleaned.match(/\[[\s\S]*?\]/);
    if (match) return { tasks: JSON.parse(match[0]) };
    throw new Error(`Cannot parse Gemini response as JSON: ${text.slice(0, 200)}...`);
  }
}

/**
 * Call Gemini API with transcript text and return structured analysis.
 * Uses REST API directly (no SDK needed — fetch is available in Node 22).
 */
async function analyzeWithGemini(transcriptText) {
  const apiKey = GEMINI_API_KEY();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured. Add it to the Lambda environment variables.');
  }

  const prompt = `${SYSTEM_PROMPT_ANALYZE}\n\nTranscript:\n${transcriptText.slice(0, 30000)}`;

  const response = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned empty response');

  return extractJson(text);
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
 * POST /meetings/invite — Create workspace invitation (routed to inviteService).
 */
export async function create(event) {
  const { path } = event;

  // Route invite requests to inviteService
  if (path && /invite/.test(path)) {
    return inviteService.handleInvite(event);
  }

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
 * GET /meetings/notifications — Get user notifications (routed to inviteService).
 */
export async function get(event) {
  const { path } = event;

  // Route notification requests to inviteService
  if (path && /notifications/.test(path)) {
    return inviteService.handleGetNotifications(event);
  }

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
  const { resourceId, parsedBody, authUser, path } = event;

  // Route notification updates to inviteService
  if (path && /notifications/.test(path)) {
    // Extract the actual notification ID from the proxy path
    const proxy = event.pathParameters?.proxy || '';
    const segments = proxy.split('/');
    const notifId = segments.length >= 2 ? segments[1] : null;
    if (notifId) event.resourceId = notifId;
    return inviteService.handleUpdateNotification(event);
  }

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
 * POST /meetings/{id}/process — Trigger AI Step Functions pipeline.
 *
 * Starts the ai-meeting-pipeline state machine which orchestrates:
 *   Transcribe → Summarize (Gemini) → Extract Tasks (Gemini) → Save → Notify
 */
export async function postProcess(event) {
  const { resourceId, authUser } = event;

  if (!resourceId) {
    return badRequest('Meeting ID is required');
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

  // A meeting creator can review their own uploaded transcript even when their
  // account-level role is Employee. Workspace owners/managers remain covered
  // by the existing non-Employee path.
  if (authUser.role === 'EMPLOYEE' && meeting.createdBy !== authUser.userId) {
    return badRequest('Only the meeting creator, managers, and admins can process meetings', 'FORBIDDEN');
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

  // ── TEXT TRANSCRIPT MODE ─────────────────────────────
  // If the meeting has inline transcript text (no audio file), process directly
  // with Gemini API and save results — no Step Functions needed.
  if (meeting.transcriptText && meeting.transcriptText.trim()) {
    try {
      const result = await analyzeWithGemini(meeting.transcriptText);

      const updates = {
        status: 'AI_REVIEW_READY',
        summary: result.summary || '',
        keyDecisions: Array.isArray(result.keyDecisions) ? result.keyDecisions : [],
        risks: Array.isArray(result.risks) ? result.risks : [],
        suggestedTasks: Array.isArray(result.tasks) ? result.tasks : [],
        updatedAt: new Date().toISOString(),
        GSI2PK: 'STATUS#AI_REVIEW_READY',
        GSI2SK: `MEETING#${meeting.createdAt}`,
      };

      await db.updateItem(key, updates);

      return success({
        meetingId: resourceId,
        status: 'AI_REVIEW_READY',
        summary: updates.summary,
        keyDecisions: updates.keyDecisions,
        tasks: updates.suggestedTasks,
        risks: updates.risks,
        message: 'AI analysis complete.',
      });
    } catch (err) {
      console.error(`[Meetings] Gemini analysis failed for ${resourceId}:`, err);
      // Revert status so retry is possible
      await db.updateItem(key, {
        status: 'UPLOADED',
        updatedAt: new Date().toISOString(),
        GSI2PK: 'STATUS#UPLOADED',
        GSI2SK: `MEETING#${meeting.createdAt}`,
      });
      return badRequest(`AI analysis failed: ${err.message}`, 'AI_ERROR');
    }
  }

  // ── AUDIO FILE MODE ─────────────────────────────────
  // Meetings with S3 storageKey go through Step Functions.
  const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN || '';

  if (!STATE_MACHINE_ARN) {
    // Mark as failed so frontend shows error state
    await db.updateItem(key, {
      status: 'FAILED',
      updatedAt: new Date().toISOString(),
      GSI2PK: 'STATUS#FAILED',
      GSI2SK: `MEETING#${meeting.createdAt}`,
    });
    return badRequest('AI pipeline not configured (STATE_MACHINE_ARN missing)', 'CONFIG_ERROR');
  }

  const pipelineInput = {
    action: 'transcribe',
    meetingId: resourceId,
    storageKey: meeting.storageKey || '',
    bucket: process.env.AUDIO_BUCKET || '',
    transcriptText: meeting.transcriptText || '',
  };

  try {
    await sfn.send(new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      input: JSON.stringify(pipelineInput),
      name: `meeting-${resourceId}-${Date.now()}`,
    }));
  } catch (err) {
    console.error(`[Meetings] Failed to start pipeline for ${resourceId}:`, err);
    // Revert status so retry is possible
    await db.updateItem(key, {
      status: 'UPLOADED',
      updatedAt: new Date().toISOString(),
      GSI2PK: 'STATUS#UPLOADED',
      GSI2SK: `MEETING#${meeting.createdAt}`,
    });
    return badRequest(`Failed to start AI pipeline: ${err.message}`, 'PIPELINE_ERROR');
  }

  return success({
    meetingId: resourceId,
    status: 'PROCESSING',
    message: 'AI pipeline started. You will be notified when analysis completes.',
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
