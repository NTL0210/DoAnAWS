/**
 * QuotaService — workspace-level usage tracking and enforcement
 *
 * Tracks daily usage per workspace. All functions return
 * { allowed, used, limit, message } for easy UI consumption.
 *
 * ── Database schema (future MongoDB / DynamoDB) ───────────────────
 * workspace_quotas/
 *   _id: ObjectId
 *   workspaceId: string (indexed)
 *   date: string "YYYY-MM-DD" (indexed, compound with workspaceId)
 *   counters: {
 *     ai_processing: Number (default 0)
 *     voice_recording: Number (default 0)
 *     storage_bytes: Number (default 0)
 *   }
 *   createdAt: ISODate
 *   updatedAt: ISODate
 *
 * Index: { workspaceId: 1, date: 1 } unique
 *
 * ── Migration path ───────────────────────────────────────────────
 * To replace the in-memory store:
 *   1. Create QuotaRepository with get/set methods matching _ensureEntry
 *   2. Replace _ensureEntry() calls with repository methods
 *   3. The function signatures (checkAiQuota, incrementAiRuns, etc.)
 *      stay unchanged — UI code needs zero modifications.
 */

import {
  AI_DAILY_RUN_LIMIT,
  MAX_JOB_CONCURRENCY,
  MAX_STORAGE_GB,
  MAX_VOICE_RECORDINGS_PER_DAY,
  QUOTA_ACTIONS,
} from '@/domain/constants/costConstants';

// ─── In-memory store (MVP only — replace with QuotaRepository) ─────
/**
 * @typedef {Object} QuotaEntry
 * @property {string} date — "YYYY-MM-DD"
 * @property {Object} counts — per-action counters
 *
 * @type {Map<string, QuotaEntry>}
 */
const _store = new Map();

function _getDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function _ensureEntry(workspaceId) {
  const today = _getDateKey();
  let entry = _store.get(workspaceId);

  if (!entry || entry.date !== today) {
    entry = {
      date: today,
      counts: {
        [QUOTA_ACTIONS.AI_PROCESSING]: 0,
        [QUOTA_ACTIONS.VOICE_RECORDING]: 0,
        [QUOTA_ACTIONS.STORAGE]: 0,
      },
    };
    _store.set(workspaceId, entry);
  }

  return entry;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Get full usage snapshot for a workspace
 *
 * @param {string} workspaceId
 * @returns {Promise<Object>}
 */
export async function getWorkspaceUsage(workspaceId) {
  const entry = _ensureEntry(workspaceId);
  return {
    workspaceId,
    date: entry.date,
    aiRuns: {
      used: entry.counts[QUOTA_ACTIONS.AI_PROCESSING] || 0,
      limit: AI_DAILY_RUN_LIMIT,
    },
    voiceRecordings: {
      used: entry.counts[QUOTA_ACTIONS.VOICE_RECORDING] || 0,
      limit: MAX_VOICE_RECORDINGS_PER_DAY,
    },
    storage: {
      used: 0,
      limit: MAX_STORAGE_GB,
      unit: 'GB',
    },
  };
}

/**
 * Check whether AI processing is allowed for this workspace
 *
 * @param {string} workspaceId
 * @returns {Promise<{ allowed: boolean, used: number, limit: number, message: string }>}
 */
export async function checkAiQuota(workspaceId) {
  const entry = _ensureEntry(workspaceId);
  const used = entry.counts[QUOTA_ACTIONS.AI_PROCESSING] || 0;

  if (used >= AI_DAILY_RUN_LIMIT) {
    return {
      allowed: false,
      used,
      limit: AI_DAILY_RUN_LIMIT,
      message: `You have reached today's AI processing limit (${AI_DAILY_RUN_LIMIT}). Please try again tomorrow.`,
    };
  }

  return {
    allowed: true,
    used,
    limit: AI_DAILY_RUN_LIMIT,
    message: '',
  };
}

/**
 * Check whether voice recording is allowed for this workspace
 *
 * @param {string} workspaceId
 * @returns {Promise<{ allowed: boolean, used: number, limit: number, message: string }>}
 */
export async function checkVoiceQuota(workspaceId) {
  const entry = _ensureEntry(workspaceId);
  const used = entry.counts[QUOTA_ACTIONS.VOICE_RECORDING] || 0;

  if (used >= MAX_VOICE_RECORDINGS_PER_DAY) {
    return {
      allowed: false,
      used,
      limit: MAX_VOICE_RECORDINGS_PER_DAY,
      message: `You have reached today's voice recording limit (${MAX_VOICE_RECORDINGS_PER_DAY}). Please try again tomorrow.`,
    };
  }

  return {
    allowed: true,
    used,
    limit: MAX_VOICE_RECORDINGS_PER_DAY,
    message: '',
  };
}

/**
 * Check storage quota
 *
 * @param {string} workspaceId
 * @param {number} [additionalBytes=0]
 * @returns {Promise<{ allowed: boolean, used: number, limit: number, message: string }>}
 */
export async function checkStorageQuota(workspaceId, additionalBytes = 0) {
  const entry = _ensureEntry(workspaceId);
  const usedGb = (entry.counts[QUOTA_ACTIONS.STORAGE] || 0) / (1024 * 1024 * 1024);
  const additionalGb = additionalBytes / (1024 * 1024 * 1024);

  if (usedGb + additionalGb >= MAX_STORAGE_GB) {
    return {
      allowed: false,
      used: Math.round(usedGb * 100) / 100,
      limit: MAX_STORAGE_GB,
      message: `Storage quota exceeded (${Math.round(usedGb * 100) / 100} GB / ${MAX_STORAGE_GB} GB). Free up space or upgrade your plan.`,
    };
  }

  return {
    allowed: true,
    used: Math.round(usedGb * 100) / 100,
    limit: MAX_STORAGE_GB,
    message: '',
  };
}

/**
 * Check whether job concurrency limit is met
 *
 * @param {string} workspaceId
 * @param {number} activeJobCount
 * @returns {{ allowed: boolean, message: string }}
 */
export async function checkJobConcurrency(workspaceId, activeJobCount) {
  if (activeJobCount >= MAX_JOB_CONCURRENCY) {
    return {
      allowed: false,
      message: `Maximum concurrent jobs reached (${MAX_JOB_CONCURRENCY}). Wait for a running job to complete or cancel one.`,
    };
  }
  return { allowed: true, message: '' };
}

/**
 * Increment AI runs counter
 *
 * @param {string} workspaceId
 * @returns {Promise<{ used: number, limit: number }>}
 */
export async function incrementAiRuns(workspaceId) {
  const entry = _ensureEntry(workspaceId);
  entry.counts[QUOTA_ACTIONS.AI_PROCESSING] = (entry.counts[QUOTA_ACTIONS.AI_PROCESSING] || 0) + 1;
  return {
    used: entry.counts[QUOTA_ACTIONS.AI_PROCESSING],
    limit: AI_DAILY_RUN_LIMIT,
  };
}

/**
 * Increment voice recording counter
 *
 * @param {string} workspaceId
 * @returns {Promise<{ used: number, limit: number }>}
 */
export async function incrementVoiceRecordings(workspaceId) {
  const entry = _ensureEntry(workspaceId);
  entry.counts[QUOTA_ACTIONS.VOICE_RECORDING] = (entry.counts[QUOTA_ACTIONS.VOICE_RECORDING] || 0) + 1;
  return {
    used: entry.counts[QUOTA_ACTIONS.VOICE_RECORDING],
    limit: MAX_VOICE_RECORDINGS_PER_DAY,
  };
}

/**
 * Estimate storage used based on file sizes recorded for a workspace
 *
 * @param {string} workspaceId
 * @param {number} bytes
 */
export async function addStorageUsage(workspaceId, bytes) {
  const entry = _ensureEntry(workspaceId);
  entry.counts[QUOTA_ACTIONS.STORAGE] = (entry.counts[QUOTA_ACTIONS.STORAGE] || 0) + bytes;
}

/**
 * Reset daily quotas — useful for testing
 */
export function resetDailyQuotas() {
  _store.clear();
}

/**
 * Get the active job count for concurrency checks
 * Can be called externally to integrate with the processing service
 *
 * @param {string} workspaceId
 * @param {Array} jobs
 * @returns {number}
 */
export function countActiveJobs(workspaceId, jobs) {
  const activeStatuses = [
    'QUEUED',
    'PROCESSING',
    'TRANSCRIBING',
    'SUMMARIZING',
    'TASK_EXTRACTION',
  ];
  return (jobs || []).filter(
    (j) => j.workspaceId === workspaceId && activeStatuses.includes(j.status)
  ).length;
}
