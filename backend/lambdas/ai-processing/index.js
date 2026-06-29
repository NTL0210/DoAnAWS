/**
 * AI Processing Lambda — Invoked by Step Functions
 *
 * Handles three actions in the AI workflow:
 *   1. transcribe    — Convert audio to text (Amazon Transcribe)
 *   2. summarize     — Generate meeting summary (Amazon Bedrock)
 *   3. extract-tasks — Extract actionable tasks (Amazon Bedrock)
 *   4. save          — Persist results to DynamoDB
 *
 * Each action receives a payload { action, meetingId, ... }
 * from the Step Functions state machine.
 *
 * @module lambdas/ai-processing/index
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { notifyParticipants } from '../shared/summaryNotification.js';

const {
  TABLE_NAME,
  ENVIRONMENT,
  AWS_REGION,
  TRANSCRIBE_OUTPUT_BUCKET,
} = process.env;

const s3 = new S3Client({ region: AWS_REGION || 'ap-southeast-1' });
const transcribe = new TranscribeClient({ region: AWS_REGION || 'ap-southeast-1' });
const ddb = new DynamoDBClient({ region: AWS_REGION || 'ap-southeast-1' });

/**
 * Main Lambda handler — dispatched by Step Functions based on action.
 */
export async function handler(event) {
  console.log('[AI Processing] Event:', JSON.stringify(event));

  const { action, meetingId, storageKey, bucket, transcript, summary, tasks } = event;

  try {
    switch (action) {
      case 'transcribe':
        return await handleTranscribe(meetingId, storageKey, bucket);

      case 'summarize':
        return await handleSummarize(meetingId, transcript);

      case 'extract-tasks':
        return await handleExtractTasks(meetingId, transcript, summary);

      case 'save':
        return await handleSave(meetingId, summary, tasks);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error(`[AI Processing] Action "${action}" failed:`, err);

    // Update meeting status to FAILED in DynamoDB
    try {
      await updateMeetingStatus(meetingId, 'FAILED', err.message);
    } catch (dbErr) {
      console.error('[AI Processing] Failed to update meeting status:', dbErr);
    }

    throw err; // Let Step Functions handle the error
  }
}

// ─── Action Handlers ──────────────────────────────────

/**
 * Step 1: Transcribe audio file to text.
 *
 * Starts an Amazon Transcribe job, or returns stored transcript
 * if transcript text is already provided or the file is a text file.
 *
 * In this hybrid architecture, ASR is handled locally via Sherpa.
 * Amazon Transcribe is available as a cloud fallback (set vi-VN for Vietnamese).
 */
async function handleTranscribe(meetingId, storageKey, bucket) {
  // If transcript text is already provided (e.g. uploaded from Sherpa local ASR)
  if (event?.transcriptText) {
    return { meetingId, transcript: event.transcriptText, status: 'TRANSCRIBED' };
  }

  if (!storageKey) {
    throw new Error('storageKey is required for cloud transcription');
  }

  // Check if it's already a text file
  if (storageKey.endsWith('.txt') || storageKey.endsWith('.md')) {
    // Read transcript directly from S3
    const transcript = await readFromS3(bucket, storageKey);
    return { meetingId, transcript, status: 'TRANSCRIBED' };
  }

  // Start Transcribe job for audio files
  const jobName = `ai-meeting-${meetingId}-${Date.now()}`;
  const mediaFormat = storageKey.split('.').pop() || 'mp3';

  await transcribe.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: 'vi-VN',
    MediaFormat: mediaFormat,
    Media: {
      MediaFileUri: `s3://${bucket}/${storageKey}`,
    },
    OutputBucketName: TRANSCRIBE_OUTPUT_BUCKET || bucket,
    OutputKey: `transcripts/${meetingId}.json`,
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 10,
    },
  }));

  // Transcribe is async — Step Functions will poll or wait
  return {
    meetingId,
    jobName,
    status: 'TRANSCRIBING',
    outputKey: `transcripts/${meetingId}.json`,
  };
}

/**
 * Step 2: Generate AI summary from transcript.
 *
 * Uses Amazon Bedrock (Claude/LLM) to summarize the meeting.
 * Falls back to mock processing when Bedrock is not configured.
 */
async function handleSummarize(meetingId, transcript) {
  if (!transcript) {
    throw new Error('Transcript is required for summarization');
  }

  const transcriptText = typeof transcript === 'string'
    ? transcript
    : transcript.transcriptText || transcript.results?.transcripts?.[0]?.transcript || '';

  if (!transcriptText.trim()) {
    throw new Error('Empty transcript text');
  }

  let summary;

  // Try Bedrock (production)
  if (process.env.BEDROCK_MODEL_ID) {
    summary = await callBedrockForSummary(transcriptText);
  } else {
    // Mock summary for development / when Bedrock is not configured
    summary = generateMockSummary(transcriptText);
  }

  return {
    meetingId,
    summary,
    transcript: transcriptText,
    status: 'SUMMARIZED',
  };
}

/**
 * Step 3: Extract tasks from transcript + summary.
 */
async function handleExtractTasks(meetingId, transcript, summary) {
  const transcriptText = typeof transcript === 'string'
    ? transcript
    : transcript?.transcriptText || '';

  const summaryText = typeof summary === 'string'
    ? summary
    : summary?.summary || '';

  let tasks;

  if (process.env.BEDROCK_MODEL_ID) {
    tasks = await callBedrockForTasks(transcriptText, summaryText);
  } else {
    // Mock task extraction for development
    tasks = generateMockTasks(transcriptText, summaryText);
  }

  return {
    meetingId,
    summary: summaryText,
    tasks,
    status: 'TASKS_EXTRACTED',
  };
}

/**
 * Step 4: Save results to DynamoDB and notify participants.
 */
async function handleSave(meetingId, summary, tasks) {
  const taskList = Array.isArray(tasks) ? tasks : [];

  await updateMeetingInDynamoDB(meetingId, {
    status: 'AI_REVIEW_READY',
    summary: typeof summary === 'string' ? summary : JSON.stringify(summary),
    suggestedTasks: taskList,
    updatedAt: new Date().toISOString(),
  });

  // Notify participants — fetch meeting details
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

      await notifyParticipants({
        meetingId,
        meetingTitle: meeting.title?.S || 'Untitled meeting',
        participantIds: Array.isArray(participantIds) ? participantIds : [],
        summary: typeof summary === 'string' ? summary : summary?.summary || '',
      });
    }
  } catch (notifErr) {
    console.error(`[AI Processing] Failed to send notifications for ${meetingId}:`, notifErr);
    // Non-fatal — don't fail the whole save
  }

  return {
    meetingId,
    status: 'AI_REVIEW_READY',
    tasksCreated: taskList.length,
    message: 'Meeting analysis complete. Review suggested tasks.',
  };
}

// ─── Bedrock Integration ──────────────────────────────

/**
 * Call Amazon Bedrock (Claude) for meeting summarization.
 */
async function callBedrockForSummary(transcript) {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    '@aws-sdk/client-bedrock-runtime'
  );

  const client = new BedrockRuntimeClient({ region: AWS_REGION || 'ap-southeast-1' });

  const prompt = `You are an AI assistant specialized in Vietnamese meeting analysis. Analyze the following Vietnamese meeting transcript. Include:

1. IMPORTANT CONTENT FILTER — Only keep the important discussion points, remove filler words, small talk, and repeated information
2. Key decisions made (các quyết định đã đưa ra)
3. Action items / công việc cần làm
4. Risks or blockers (rủi ro hoặc vấn đề)
5. A short Vietnamese summary (tóm tắt ngắn gọn bằng tiếng Việt)

Transcript:
${transcript.slice(0, 30000)}

Analysis:`;

  const command = new InvokeModelCommand({
    ModelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
    ContentType: 'application/json',
    Body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });

  const response = await client.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));
  return decoded.content?.[0]?.text || 'Summary generation failed';
}

/**
 * Call Amazon Bedrock (Claude) for task extraction.
 */
async function callBedrockForTasks(transcript, summary) {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    '@aws-sdk/client-bedrock-runtime'
  );

  const client = new BedrockRuntimeClient({ region: AWS_REGION || 'ap-southeast-1' });

  const prompt = `Extract actionable tasks from the following meeting transcript and summary.

Return a JSON array of tasks. Each task must have: title, description, priority (LOW|MEDIUM|HIGH|URGENT), confidence (0.0-1.0).

Rules:
- Only extract tasks that are explicitly stated or clearly implied.
- If a task has a named assignee, include assigneeName.
- If a deadline is mentioned, include deadline (YYYY-MM-DD format).
- If the transcript is unclear about a task, set confidence < 0.5.
- Return raw JSON array only, no markdown formatting.

Meeting Summary:
${summary.slice(0, 5000)}

Transcript Excerpt:
${transcript.slice(0, 30000)}

Tasks JSON:`;

  const command = new InvokeModelCommand({
    ModelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
    ContentType: 'application/json',
    Body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });

  const response = await client.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));

  // Parse JSON from LLM response
  try {
    const text = decoded.content?.[0]?.text || '[]';
    // Extract JSON array from response (handles markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}

// ─── Mock Processing (Development) ────────────────────

function generateMockSummary(transcript) {
  const lines = transcript.split('\n').filter((l) => l.trim());
  const speakers = [...new Set(lines.map((l) => l.split(':')[0]?.trim()).filter(Boolean))];

  return `# Meeting Summary

## Participants
${speakers.map((s) => `- ${s}`).join('\n')}

## Discussion Points
${lines.slice(0, 5).map((l) => `- ${l.trim()}`).join('\n')}${lines.length > 5 ? '\n- ... (additional discussion)' : ''}

## Key Decisions
- Action items were identified for follow-up

## Next Steps
- Review extracted tasks
- Assign owners and deadlines

---
*Generated by Mock AI (dev mode). In production, Amazon Bedrock provides the analysis.*`;
}

function generateMockTasks(transcript, summary) {
  const lines = transcript.split('\n').filter((l) => l.trim());
  const tasks = [];

  for (const line of lines) {
    const taskMatch = line.match(
      /(?:need to|have to|must|should|will|going to|action item|to-do|todo)[:\s]+(.+)/i
    );
    if (taskMatch && tasks.length < 5) {
      const desc = taskMatch[1].trim();
      tasks.push({
        title: desc.slice(0, 80),
        description: desc,
        priority: desc.toLowerCase().includes('urgent') ? 'URGENT' : 'MEDIUM',
        confidence: 0.6,
        sourceQuote: line,
      });
    }
  }

  if (tasks.length === 0) {
    tasks.push({
      title: 'Review meeting transcript',
      description: 'Review the meeting content and identify action items',
      priority: 'MEDIUM',
      confidence: 0.5,
      sourceQuote: 'General meeting review needed',
    });
  }

  return tasks;
}

// ─── DynamoDB Helpers ─────────────────────────────────

async function updateMeetingStatus(meetingId, status, error) {
  const key = { PK: { S: `MEETING#${meetingId}` }, SK: { S: `META#${meetingId}` } };
  const now = new Date().toISOString();

  const updateExpr = ['SET #status = :status, #updatedAt = :updatedAt'];
  const attrNames = { '#status': 'status', '#updatedAt': 'updatedAt' };
  const attrValues = {
    ':status': { S: status },
    ':updatedAt': { S: now },
  };

  if (error) {
    updateExpr.push('#error = :error');
    attrNames['#error'] = 'processingError';
    attrValues[':error'] = { S: error };
  }

  await ddb.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: key,
    UpdateExpression: updateExpr.join(', '),
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  }));
}

async function updateMeetingInDynamoDB(meetingId, fields) {
  const key = { PK: { S: `MEETING#${meetingId}` }, SK: { S: `META#${meetingId}` } };

  const updateExpr = [];
  const attrNames = {};
  const attrValues = {};

  let i = 0;
  for (const [field, value] of Object.entries(fields)) {
    const key = `#f${i}`;
    const val = `:v${i}`;
    updateExpr.push(`${key} = ${val}`);
    attrNames[key] = field;
    attrValues[val] = typeof value === 'object' ? { S: JSON.stringify(value) } : { S: String(value) };
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

// ─── S3 Helper ────────────────────────────────────────

async function readFromS3(bucket, key) {
  const response = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
  return await response.Body.transformToString('utf-8');
}

export default { handler };
