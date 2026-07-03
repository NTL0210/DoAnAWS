/**
 * AI Process Lambda — Layer 3 (Audio → Gemini File API → Result)
 *
 * Actions:
 *   process-audio     — Đọc MP3 từ S3 → upload Gemini File API → transcribe + phân tích
 *   analyze           — Đọc transcript từ S3 → Gemini → result
 *
 * Dùng Gemini File API cho audio lớn (cuộc họp 1-2h, vài chục MB).
 *
 * @module lambdas/ai-processing/index
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  callGemini,
  uploadToGemini,
  callGeminiWithFile,
  extractJson,
  SYSTEM_PROMPT_AUDIO,
  SYSTEM_PROMPT_ANALYZE,
} from './geminiService.js';

const { AWS_REGION, GEMINI_MODEL } = process.env;
const s3 = new S3Client({ region: AWS_REGION || 'ap-southeast-1' });
const MODEL = GEMINI_MODEL || 'gemini-2.5-flash';

export async function handler(event) {
  console.log('[Process] Event:', JSON.stringify(event).slice(0, 500));

  const { action, meetingId, bucket, storageKey, transcriptKey } = event;

  try {
    switch (action) {
      case 'process-audio':
        return await processAudio(meetingId, bucket, storageKey);
      case 'analyze':
      default:
        return await analyzeWithGemini(meetingId, bucket, transcriptKey);
    }
  } catch (err) {
    console.error(`[Process] Error:`, err);
    throw err;
  }
}

/**
 * Read audio from S3 → upload to Gemini File API → transcribe + analyze
 * Hỗ trợ file lớn (cuộc họp 1-2h) vì dùng File API, không inline.
 */
async function processAudio(meetingId, bucket, storageKey) {
  if (!storageKey) throw new Error('storageKey is required');

  const mimeType = storageKey.endsWith('.wav') ? 'audio/wav'
    : storageKey.endsWith('.ogg') ? 'audio/ogg'
    : storageKey.endsWith('.m4a') ? 'audio/mp4'
    : 'audio/mpeg';

  // 1. Read audio from S3
  console.log(`[Process] Reading s3://${bucket}/${storageKey}`);
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  const buffer = Buffer.from(await response.Body.transformToByteArray());
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
  console.log(`[Process] Audio size: ${sizeMB}MB, type: ${mimeType}`);

  if (buffer.length === 0) {
    throw new Error('Empty audio file');
  }

  // 2. Upload to Gemini File API (hỗ trợ file đến 2GB)
  console.log(`[Process] Uploading to Gemini File API...`);
  const fileUri = await uploadToGemini(buffer, mimeType);

  // 3. Call Gemini with file reference + prompt
  console.log(`[Process] Analyzing with Gemini...`);
  const raw = await callGeminiWithFile(MODEL, fileUri, mimeType, SYSTEM_PROMPT_AUDIO, {
    temperature: 0.3,
    maxOutputTokens: 8192,
  });

  console.log(`[Process] Gemini response received for ${meetingId}`);
  const result = extractJson(raw);

  return {
    meetingId,
    transcript: result.transcript || '',
    summary: result.summary || '',
    keyDecisions: result.keyDecisions || [],
    tasks: result.tasks || [],
    risks: result.risks || [],
    status: 'ANALYZED',
    model: MODEL,
  };
}

/** Read transcript JSON from S3 → analyze with Gemini */
async function analyzeWithGemini(meetingId, bucket, transcriptKey) {
  if (!transcriptKey) throw new Error('transcriptKey is required');

  const raw = await readFromS3(bucket, transcriptKey);
  let text = raw;
  try {
    const parsed = JSON.parse(raw);
    text = parsed.results?.transcripts?.[0]?.transcript || parsed.transcript || raw;
  } catch {}

  if (!text.trim()) throw new Error('Empty transcript');

  const prompt = `${SYSTEM_PROMPT_ANALYZE}\n\nTranscript:\n${text.slice(0, 30000)}`;
  const geminiRaw = await callGemini(MODEL, prompt, { temperature: 0.3, maxOutputTokens: 4096 });
  const result = extractJson(geminiRaw);

  return {
    meetingId,
    summary: result.summary || '',
    keyDecisions: result.keyDecisions || [],
    tasks: result.tasks || [],
    risks: result.risks || [],
    status: 'ANALYZED',
    model: MODEL,
  };
}

async function readFromS3(bucket, key) {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return await r.Body.transformToString('utf-8');
}

export default { handler };
