/**
 * AiUsage — tracks AI analysis usage per meeting
 *
 * Cache invalidation rules:
 * - transcriptHash changed  → transcript content modified → invalid
 * - contextHash changed     → participants/team/settings changed → invalid
 * - promptVersion changed   → AI prompts updated → invalid
 * - modelVersion changed    → AI model upgraded → invalid
 *
 * Used by aiMeetingService. In mock mode stored in-memory;
 * in API mode stored alongside meeting data.
 */

/**
 * Current AI prompt version — increment when prompts change
 * to force cache invalidation across all meetings.
 */
export const AI_PROMPT_VERSION = '1.0';

/**
 * Current AI model version — increment when the model is upgraded
 * (e.g., from gpt-4 to gpt-4-turbo).
 */
export const AI_MODEL_VERSION = 'gpt-4-2024-08';

/**
 * Create a new AiUsage record
 *
 * @param {Object} params
 * @param {string} params.meetingId
 * @param {string} params.transcriptHash
 * @param {string} [params.contextHash] — hash of participants + team + settings
 * @param {string} [params.promptVersion=AI_PROMPT_VERSION]
 * @param {string} [params.modelVersion=AI_MODEL_VERSION]
 * @returns {Object} usage record
 */
export function createAiUsage({ meetingId, transcriptHash, contextHash, promptVersion, modelVersion }) {
  return {
    meetingId,
    transcriptHash,
    contextHash: contextHash || '',
    promptVersion: promptVersion || AI_PROMPT_VERSION,
    modelVersion: modelVersion || AI_MODEL_VERSION,
    lastAnalyzedAt: new Date().toISOString(),
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    aiRunCount: 1,
    cached: false,
  };
}

/**
 * Check whether a cached result is still valid.
 *
 * Returns true if ANY cache key has changed — meaning the cache
 * should be invalidated.
 *
 * @param {Object|null} usage — existing AiUsage record (null = no cache)
 * @param {string} newTranscriptHash
 * @param {string} [newContextHash]
 * @param {string} [promptVersion]
 * @param {string} [modelVersion]
 * @returns {boolean}
 */
export function hasCacheChanged(usage, newTranscriptHash, newContextHash, promptVersion, modelVersion) {
  if (!usage) return true;

  if (usage.transcriptHash !== newTranscriptHash) return true;
  if (newContextHash && usage.contextHash !== newContextHash) return true;
  if (promptVersion && usage.promptVersion !== promptVersion) return true;
  if (modelVersion && usage.modelVersion !== modelVersion) return true;

  return false;
}

/**
 * Legacy alias — kept for backward compatibility.
 *
 * @deprecated Use hasCacheChanged() which also checks context + version.
 */
export const hasTranscriptChanged = hasCacheChanged;

/**
 * Create a snapshot object for cache comparison (all keys).
 *
 * @param {Object} usage
 * @returns {{ transcriptHash: string, contextHash: string, promptVersion: string, modelVersion: string, runCount: number }}
 */
export function toCacheKey(usage) {
  return {
    transcriptHash: usage?.transcriptHash || '',
    contextHash: usage?.contextHash || '',
    promptVersion: usage?.promptVersion || AI_PROMPT_VERSION,
    modelVersion: usage?.modelVersion || AI_MODEL_VERSION,
    runCount: usage?.aiRunCount || 0,
  };
}
