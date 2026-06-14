/**
 * AiMeetingService — AI analysis with caching, cost estimation, and validation
 *
 * Cache is invalidated when ANY of these change:
 *   - transcriptHash  (transcript content modified)
 *   - contextHash     (participants / team / settings changed)
 *   - promptVersion   (AI prompts updated)
 *   - modelVersion    (AI model upgraded)
 *
 * Features:
 * - Transcript hash-based caching
 * - Cost estimation before processing
 * - Input validation (empty, size limits)
 * - Re-analyze support (bypasses cache)
 */

import { analyzeMeeting } from '@/services/meetingService';
import {
  MAX_TRANSCRIPT_CHARS_FOR_SINGLE_AI_REQUEST,
  AI_COST_TIERS,
  ESTIMATED_CHARS_PER_TOKEN,
} from '@/domain/constants/costConstants';
import {
  createAiUsage,
  hasCacheChanged,
  AI_PROMPT_VERSION,
  AI_MODEL_VERSION,
} from '@/domain/models/AiUsage';

// ─── In-memory cache ────────────────────────────────────────────────
/** @type {Map<string, { meetingId: string, hash: string, contextHash: string, promptVersion: string, modelVersion: string, result: Object, aiUsage: Object }>} */
const _cache = new Map();

// ─── String hashing ─────────────────────────────────────────────────

/**
 * Compute a simple string hash
 *
 * @param {string} str
 * @returns {string}
 */
export function computeTranscriptHash(str) {
  if (!str) return '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Compute a context hash from meeting context (participants, team, settings).
 *
 * Changes when participants are added/removed or the target team changes,
 * even if the transcript text is identical.
 *
 * @param {Object} [context={}]
 * @param {Array} [context.participantIds]
 * @param {string} [context.teamId]
 * @param {Object} [context.workspace]
 * @returns {string}
 */
export function computeContextHash(context = {}) {
  const parts = [
    context.teamId || '',
    ...(context.participantIds || []).sort(),
    context.workspace?.id || '',
  ];
  const raw = parts.join('|');
  if (!raw) return '';

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Analyze a transcript — returns cached result if nothing has changed
 *
 * Cache is valid only when ALL of these match:
 *   - transcript hash
 *   - context hash (participants + team)
 *   - prompt version
 *   - model version
 *
 * @param {string} transcript
 * @param {Object} [context={}]
 * @param {boolean} [context.forceReAnalyze=false] — bypass cache
 * @param {string} [context.meetingId]
 * @param {string} [context.title]
 * @param {string} [context.teamId]
 * @param {Array} [context.participantIds]
 * @returns {Promise<Object>} { summary, suggestedTasks, cached, aiUsage }
 */
export async function analyzeTranscript(transcript, context = {}) {
  const meetingId = context.meetingId;
  const forceReAnalyze = context.forceReAnalyze === true;

  // Validate input
  const validation = validateBeforeAiProcessing(transcript);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compute hashes
  const transcriptHash = computeTranscriptHash(transcript);
  const contextHash = computeContextHash(context);

  // Check cache (only if we have a meetingId, not forcing re-analyze,
  // and all cache keys match)
  if (meetingId && !forceReAnalyze) {
    const cached = _cache.get(meetingId);
    if (
      cached &&
      !hasCacheChanged(
        cached.aiUsage,
        transcriptHash,
        contextHash,
        AI_PROMPT_VERSION,
        AI_MODEL_VERSION
      )
    ) {
      return {
        ...cached.result,
        cached: true,
        aiUsage: { ...cached.aiUsage, cached: true },
      };
    }
  }

  // Perform analysis
  const result = await analyzeMeeting(
    {
      title: context.title || 'Meeting',
      transcriptText: transcript,
      teamId: context.teamId,
    },
    context
  );

  // Update cache with all version keys
  if (meetingId) {
    const aiUsage = createAiUsage({
      meetingId,
      transcriptHash,
      contextHash,
      promptVersion: AI_PROMPT_VERSION,
      modelVersion: AI_MODEL_VERSION,
    });
    _cache.set(meetingId, {
      meetingId,
      transcriptHash,
      contextHash,
      promptVersion: AI_PROMPT_VERSION,
      modelVersion: AI_MODEL_VERSION,
      result,
      aiUsage,
    });
  }

  return {
    ...result,
    cached: false,
  };
}

/**
 * Extract suggested tasks from a transcript (cached)
 *
 * @param {string} transcript
 * @param {Object} [context={}]
 * @returns {Promise<Array>}
 */
export async function extractSuggestedTasks(transcript, context = {}) {
  const result = await analyzeTranscript(transcript, context);
  return result.suggestedTasks || [];
}

/**
 * Summarize a meeting (cached)
 *
 * @param {string} transcript
 * @param {Object} [context={}]
 * @returns {Promise<Object>}
 */
export async function summarizeMeeting(transcript, context = {}) {
  const result = await analyzeTranscript(transcript, context);
  return {
    aiSummary: result.aiSummary || result.summary || '',
    keyDecisions: result.keyDecisions || [],
    risks: result.risks || [],
    actionItems: result.actionItems || [],
  };
}

/**
 * Estimate AI processing cost from transcript length
 *
 * @param {string} transcript
 * @returns {{ estimatedTokens: number, estimatedCost: string, estimatedCents: number, tier: string }}
 */
export function estimateAiCost(transcript) {
  if (!transcript) {
    return { estimatedTokens: 0, estimatedCost: 'Free', estimatedCents: 0, tier: 'small' };
  }

  const charCount = transcript.length;
  const estimatedTokens = Math.ceil(charCount / ESTIMATED_CHARS_PER_TOKEN);

  let tier = AI_COST_TIERS.small;
  if (charCount > AI_COST_TIERS.small.maxChars) tier = AI_COST_TIERS.medium;
  if (charCount > AI_COST_TIERS.medium.maxChars) tier = AI_COST_TIERS.large;

  return {
    estimatedTokens,
    estimatedCost: `~${tier.label}`,
    estimatedCents: tier.cents,
    tier: tier.label.toLowerCase(),
  };
}

/**
 * Validate inputs before sending to AI
 *
 * @param {string} transcript
 * @returns {{ valid: boolean, error?: string, warnings?: string[] }}
 */
export function validateBeforeAiProcessing(transcript) {
  const warnings = [];

  if (!transcript || !transcript.trim()) {
    return { valid: false, error: 'Transcript is empty. Please provide meeting content.' };
  }

  if (transcript.length > MAX_TRANSCRIPT_CHARS_FOR_SINGLE_AI_REQUEST) {
    warnings.push(
      `Transcript is very long (${transcript.length.toLocaleString()} chars). Consider splitting into parts for better accuracy.`
    );
  }

  if (transcript.trim().split(/\s+/).length < 10) {
    warnings.push('Transcript appears very short. AI results may be limited.');
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Check whether a meeting's cache has changed (transcript, context, or version)
 *
 * @param {string} meetingId
 * @param {string} newTranscript
 * @param {Object} [context={}]
 * @returns {Promise<boolean>} — true if cache should be invalidated
 */
export async function checkCacheChanged(meetingId, newTranscript, context = {}) {
  const cached = _cache.get(meetingId);
  if (!cached) return true;

  const newTranscriptHash = computeTranscriptHash(newTranscript);
  const newContextHash = computeContextHash(context);

  return hasCacheChanged(
    cached.aiUsage,
    newTranscriptHash,
    newContextHash,
    AI_PROMPT_VERSION,
    AI_MODEL_VERSION
  );
}

/**
 * Legacy alias — kept for backward compatibility
 *
 * @deprecated Use checkCacheChanged() instead
 */
export const checkTranscriptChanged = checkCacheChanged;

/**
 * Clear cache for a specific meeting (for re-analyze)
 *
 * @param {string} meetingId
 */
export function clearCache(meetingId) {
  if (meetingId) {
    _cache.delete(meetingId);
  }
}

/**
 * Get cached result info (without re-analyzing)
 *
 * @param {string} meetingId
 * @returns {Object|null}
 */
export function getCachedResult(meetingId) {
  return _cache.get(meetingId) || null;
}

/**
 * Get current version info for debugging
 *
 * @returns {{ promptVersion: string, modelVersion: string }}
 */
export function getVersionInfo() {
  return {
    promptVersion: AI_PROMPT_VERSION,
    modelVersion: AI_MODEL_VERSION,
  };
}
