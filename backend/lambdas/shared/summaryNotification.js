/**
 * Summary Notification — sends meeting summary notifications to participants
 *
 * Called at the end of the AI processing pipeline to notify meeting
 * participants that AI analysis (summary, decisions, action items) is ready.
 *
 * @module lambdas/shared/summaryNotification
 */

import { randomUUID } from 'node:crypto';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { ENTITY, pk } from '../../src/dynamodb/entityTypes.js';

const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const TABLE_NAME = process.env.TABLE_NAME || 'ai-meeting-platform';

/**
 * Send AI summary notifications to meeting participants.
 *
 * Creates a notification for each participant indicating that the
 * AI analysis (summary, key decisions, action items) is available.
 *
 * @param {Object} options
 * @param {string} options.meetingId
 * @param {string} options.meetingTitle
 * @param {string[]} options.participantIds - Array of user IDs to notify
 * @param {string} [options.summary] - Brief summary snippet to include
 * @returns {Promise<{ sent: number }>} Number of notifications sent
 */
export async function notifyParticipants({ meetingId, meetingTitle, participantIds = [], summary }) {
  if (!participantIds.length) {
    return { sent: 0 };
  }

  const now = new Date().toISOString();
  const summaryPreview = (summary || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 150);

  let sent = 0;

  for (const userId of participantIds) {
    const notif = {
      PK: { S: pk(ENTITY.NOTIFICATION, userId) },
      SK: { S: `NOTIF#${randomUUID()}` },
      id: { S: randomUUID() },
      userId: { S: userId },
      type: { S: 'MEETING_READY' },
      title: { S: `AI Summary: ${meetingTitle}` },
      message: { S: summaryPreview || `AI analysis is ready for "${meetingTitle}". View summary, decisions, and suggested tasks.` },
      link: { S: `/meetings/${meetingId}` },
      isRead: { BOOL: false },
      createdAt: { S: now },
      expiresAt: { N: String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) }, // 30 days TTL
    };

    await ddb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: notif,
    }));

    sent++;
  }

  console.log(`[SummaryNotification] Sent ${sent} notifications for meeting ${meetingId}`);
  return { sent };
}

export default { notifyParticipants };
