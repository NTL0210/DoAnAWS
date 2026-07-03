/**
 * Save Lambda — persists AI analysis results to DynamoDB + notify participants
 *
 * Layer 3, Step 5: Nhận kết quả từ LLM Lambda, lưu vào DynamoDB,
 * gửi notification cho participants, và cleanup audio khỏi S3.
 *
 * @module lambdas/ai-processing/save
 */

import {
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { notifyParticipants } from './summaryNotification.js';

const {
  TABLE_NAME,
  AWS_REGION,
} = process.env;

const s3 = new S3Client({ region: AWS_REGION || 'ap-southeast-1' });
const ddb = new DynamoDBClient({ region: AWS_REGION || 'ap-southeast-1' });

/**
 * Main handler — save analysis results to DynamoDB.
 *
 * Input:
 * {
 *   meetingId,         // string
 *   summary,           // string
 *   keyDecisions,      // string[]
 *   tasks,             // Array<{title, description, assignee, priority, deadline}>
 *   risks,             // string[]
 *   bucket             // S3 bucket name (for cleanup)
 * }
 *
 * Output:
 * {
 *   meetingId,
 *   status: 'COMPLETED',
 *   tasksCreated: number,
 *   message: string
 * }
 */
export async function handler(event) {
  console.log('[Save] Event:', JSON.stringify(event, null, 2));

  const {
    meetingId,
    summary,
    transcript,
    keyDecisions,
    tasks,
    risks,
    bucket,
  } = event;

  if (!meetingId) {
    throw new Error('[Save] meetingId is required');
  }

  // ─── 1. Save to DynamoDB ────────────────────────────
  const taskList = Array.isArray(tasks) ? tasks : [];
  const decisionsList = Array.isArray(keyDecisions) ? keyDecisions : [];
  const risksList = Array.isArray(risks) ? risks : [];

  await updateMeetingInDynamoDB(meetingId, {
    status: 'AI_REVIEW_READY',
    summary: summary || '',
    transcript: transcript || '',
    keyDecisions: decisionsList,
    risks: risksList,
    suggestedTasks: taskList,
    aiProcessedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log(`[Save] Meeting ${meetingId} updated in DynamoDB with AI results`);

  // ─── 2. Notify participants ─────────────────────────
  try {
    const meetingKey = {
      PK: { S: `MEETING#${meetingId}` },
      SK: { S: `META#${meetingId}` },
    };
    const meetingData = await ddb.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: meetingKey,
    }));

    const meeting = meetingData.Item;
    if (meeting) {
      const participantIds = meeting.participantIds?.S
        ? JSON.parse(meeting.participantIds.S)
        : [];

      if (Array.isArray(participantIds) && participantIds.length > 0) {
        await notifyParticipants({
          meetingId,
          meetingTitle: meeting.title?.S || 'Untitled meeting',
          participantIds,
          summary: summary || '',
        });
        console.log(`[Save] Notified ${participantIds.length} participants for ${meetingId}`);
      }
    }
  } catch (notifErr) {
    // Non-fatal — don't fail the whole save
    console.error(`[Save] Failed to send notifications for ${meetingId}:`, notifErr);
  }

  // ─── 3. Cleanup audio from S3 ───────────────────────
  if (bucket) {
    try {
      const deleted = await cleanupMeetingAudio(bucket, meetingId);
      console.log(`[Save] Cleaned up ${deleted} files from S3 for meeting ${meetingId}`);
    } catch (cleanupErr) {
      console.warn(`[Save] Audio cleanup failed (non-fatal): ${cleanupErr.message}`);
    }
  }

  return {
    meetingId,
    status: 'COMPLETED',
    tasksCreated: taskList.length,
    decisionsCount: decisionsList.length,
    message: 'AI analysis complete. Results saved to database.',
  };
}

// ─── DynamoDB Helpers ─────────────────────────────────

/**
 * Update meeting record in DynamoDB with AI analysis results.
 */
async function updateMeetingInDynamoDB(meetingId, fields) {
  const key = {
    PK: { S: `MEETING#${meetingId}` },
    SK: { S: `META#${meetingId}` },
  };

  const updateExpr = [];
  const attrNames = {};
  const attrValues = {};

  let i = 0;
  for (const [field, value] of Object.entries(fields)) {
    const nameKey = `#f${i}`;
    const valKey = `:v${i}`;
    updateExpr.push(`${nameKey} = ${valKey}`);
    attrNames[nameKey] = field;
    attrValues[valKey] = typeof value === 'object'
      ? { S: JSON.stringify(value) }
      : { S: String(value) };
    i++;
  }

  await ddb.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: key,
    UpdateExpression: `SET ${updateExpr.join(', ')}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  }));
}

// ─── S3 Cleanup ───────────────────────────────────────
// Xoá audio + transcript khỏi S3 sau khi AI xử lý xong.

const CLEANUP_PREFIXES = ['uploads/', 'transcripts/'];

async function cleanupMeetingAudio(bucket, meetingId) {
  if (!bucket || !meetingId) return 0;

  let deletedCount = 0;

  for (const prefix of CLEANUP_PREFIXES) {
    try {
      const listed = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}${meetingId}`,
      }));

      const objects = (listed.Contents || []).filter((obj) => obj.Key);
      if (objects.length === 0) continue;

      for (const obj of objects) {
        await s3.send(new DeleteObjectCommand({
          Bucket: bucket,
          Key: obj.Key,
        }));
        deletedCount++;
        console.log(`[Save:Cleanup] Deleted s3://${bucket}/${obj.Key}`);
      }
    } catch (err) {
      console.warn(`[Save:Cleanup] Failed prefix ${prefix}${meetingId}: ${err.message}`);
    }
  }

  return deletedCount;
}

export default { handler };
