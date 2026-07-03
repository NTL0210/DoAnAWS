/**
 * LLM Lambda — gọi Gemini AI (trực tiếp, không qua OpenRouter)
 *
 * Layer 3, Step 4: Nhận transcript đã clean từ PreProcess,
 * gọi Gemini API để phân tích, trả về JSON có summary + tasks + decisions + risks.
 *
 * Dùng gemini-2.0-flash (free tier) — config qua GEMINI_API_KEY env var.
 *
 * @module lambdas/ai-processing/llm
 */

import { callGemini, extractJson, SYSTEM_PROMPT_ANALYZE, SYSTEM_PROMPT_TASKS } from './geminiService.js';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

/**
 * Main handler — gọi Gemini để analyze transcript.
 *
 * Input:  { meetingId, transcript }
 * Output: { meetingId, summary, keyDecisions, tasks, risks, status, usage }
 */
export async function handler(event) {
  console.log('[LLM] Event:', JSON.stringify(event, null, 2));

  const {
    meetingId,
    transcript,
  } = event;

  if (!transcript) {
    throw new Error('[LLM] Transcript is required');
  }

  const transcriptText = typeof transcript === 'string'
    ? transcript
    : transcript.cleanedTranscript || transcript.transcriptText || '';

  if (!transcriptText.trim()) {
    throw new Error('[LLM] Empty transcript text');
  }

  // Check Gemini API key
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('[LLM] GEMINI_API_KEY not configured — set in Lambda env var or GitHub Secrets');
  }

  // Truncate để tránh vượt token limit (30k chars ~= 7.5k tokens)
  const truncated = transcriptText.slice(0, 30000);

  try {
    // Gọi Gemini 1 lần với SYSTEM_PROMPT_ANALYZE — lấy cả summary + tasks + decisions + risks
    const prompt = `${SYSTEM_PROMPT_ANALYZE}\n\nTranscript:\n${truncated}`;
    const raw = await callGemini(
      GEMINI_MODEL,
      prompt,
      { temperature: 0.3, maxOutputTokens: 4096 }
    );

    console.log(`[LLM] Gemini response received for ${meetingId}`);

    // Parse JSON từ response
    const result = extractJson(raw);

    return {
      meetingId,
      summary: result.summary || '',
      keyDecisions: result.keyDecisions || [],
      tasks: result.tasks || [],
      risks: result.risks || [],
      status: 'ANALYZED',
      model: GEMINI_MODEL,
      usage: {}, // Gemini không trả usage tokens qua REST
    };
  } catch (err) {
    console.error(`[LLM] Gemini call failed for meeting ${meetingId}:`, err);
    throw err;
  }
}

export default { handler };
