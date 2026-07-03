/**
 * Preprocess Lambda — cleans and normalizes raw transcript text
 *
 * Layer 3, Step 3: Receives transcript from Transcribe (or uploaded text),
 * then normalizes it before sending to the LLM service.
 *
 * Handles 2 actions:
 *   1. preprocess    — clean + normalize transcript text
 *   2. extract-text  — read transcript from S3 JSON output
 *
 * @module lambdas/ai-processing/preprocess
 */

import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const { AWS_REGION } = process.env;
const s3 = new S3Client({ region: AWS_REGION || 'ap-southeast-1' });

/**
 * Main handler.
 */
export async function handler(event) {
  console.log('[PreProcess] Event:', JSON.stringify(event));

  const { action, meetingId, transcript, bucket, key } = event;

  try {
    switch (action) {
      case 'extract-text':
        return await handleExtractText(meetingId, bucket, key);
      case 'preprocess':
      default:
        return await handlePreprocess(meetingId, transcript);
    }
  } catch (err) {
    console.error('[PreProcess] Error:', err);
    throw err;
  }
}

/**
 * Extract transcript text from S3 Transcribe JSON output.
 * Used when Transcribe writes to S3 and we need to extract the text.
 */
async function handleExtractText(meetingId, bucket, key) {
  if (!key) {
    throw new Error('S3 key is required for extract-text');
  }

  const response = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
  const raw = await response.Body.transformToString('utf-8');

  // Parse Transcribe JSON output
  let transcript = raw;
  try {
    const parsed = JSON.parse(raw);
    transcript = parsed.results?.transcripts?.[0]?.transcript
      || parsed.transcript
      || raw;
  } catch {
    // Not JSON — treat as plain text
  }

  const cleaned = cleanTranscript(transcript);

  return {
    meetingId,
    cleanedTranscript: cleaned,
    transcriptLength: cleaned.length,
    wordCount: cleaned.split(/\s+/).filter(Boolean).length,
    status: 'PREPROCESSED',
  };
}

/**
 * Clean and normalize transcript text.
 * Removes filler words, normalizes whitespace, strips timestamps/annotations.
 */
async function handlePreprocess(meetingId, transcript) {
  if (!transcript) {
    throw new Error('Transcript text is required for preprocessing');
  }

  const transcriptText = typeof transcript === 'string'
    ? transcript
    : transcript.transcriptText || transcript.results?.transcripts?.[0]?.transcript || '';

  if (!transcriptText.trim()) {
    throw new Error('Empty transcript text');
  }

  const cleaned = cleanTranscript(transcriptText);

  return {
    meetingId,
    cleanedTranscript: cleaned,
    transcriptLength: cleaned.length,
    wordCount: cleaned.split(/\s+/).filter(Boolean).length,
    status: 'PREPROCESSED',
  };
}

/**
 * Normalise transcript: strip filler words, annotations, compact whitespace.
 */
function cleanTranscript(text) {
  return text
    .replace(/\r\n/g, '\n')                          // normalize line endings
    .replace(/\[.*?\]/g, '')                          // remove [Music], [Applause], [silence]
    .replace(/\(.*?\)/g, '')                           // remove (laughs), (coughs)
    .replace(/<[^>]+>/g, '')                           // remove any HTML/XML tags
    .replace(/\b(uh|um|ah|er|like|you know)\b/gi, '') // remove English filler words
    .replace(/\b(ừ|à|ờ|ơ|nhỉ|nhé|thì là)\b/gi, '')   // remove Vietnamese filler words
    .replace(/\s+/g, ' ')                              // compact whitespace
    .replace(/\n{3,}/g, '\n\n')                        // limit blank lines
    .trim();
}

export default { handler };
