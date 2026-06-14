/**
 * ProcessingJob — models an async AI processing job for a meeting
 *
 * Job lifecycle:
 *   QUEUED → PROCESSING → TRANSCRIBING → SUMMARIZING → TASK_EXTRACTION → COMPLETED
 *                                                      ↘ FAILED
 *   Any state → CANCELLED
 */

import { JOB_STATUSES } from '@/domain/constants/costConstants';

/**
 * Create a new ProcessingJob
 *
 * @param {Object} params
 * @param {string} params.meetingId
 * @param {string} params.workspaceId
 * @param {string} [params.createdBy]
 * @returns {Object} job
 */
export function createProcessingJob({ meetingId, workspaceId, createdBy }) {
  return {
    id: generateJobId(),
    meetingId,
    workspaceId,
    status: JOB_STATUSES.QUEUED,
    progress: 0,
    result: null,
    error: null,
    createdBy: createdBy || 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    retryCount: 0,
    maxRetries: 3,
  };
}

/**
 * Transition a job to the next status
 *
 * @param {Object} job
 * @param {string} newStatus
 * @param {Object} [extra]
 * @returns {Object} updated job
 */
export function transitionJob(job, newStatus, extra = {}) {
  const now = new Date().toISOString();
  const updated = {
    ...job,
    status: newStatus,
    updatedAt: now,
    ...extra,
  };

  if (newStatus === JOB_STATUSES.CANCELLED) {
    updated.completedAt = now;
  }
  if (newStatus === JOB_STATUSES.FAILED) {
    updated.error = extra.error || 'Unknown error';
    updated.retryCount = (job.retryCount || 0) + 1;
  }
  if (newStatus === JOB_STATUSES.COMPLETED) {
    updated.completedAt = now;
    updated.result = extra.result || null;
    updated.progress = 100;
  }

  return updated;
}

/**
 * Calculate progress percentage from current status
 *
 * @param {string} status
 * @returns {number}
 */
export function statusProgress(status) {
  const map = {
    [JOB_STATUSES.QUEUED]: 0,
    [JOB_STATUSES.PROCESSING]: 15,
    [JOB_STATUSES.TRANSCRIBING]: 35,
    [JOB_STATUSES.SUMMARIZING]: 60,
    [JOB_STATUSES.TASK_EXTRACTION]: 85,
    [JOB_STATUSES.COMPLETED]: 100,
    [JOB_STATUSES.FAILED]: 0,
    [JOB_STATUSES.CANCELLED]: 0,
  };
  return map[status] || 0;
}

// ─── Internal helpers ────────────────────────────────────────────────

let _counter = 0;

function generateJobId() {
  _counter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `job_${ts}_${rand}_${_counter}`;
}

export { generateJobId as _genJobId };
