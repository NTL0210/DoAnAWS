/**
 * MeetingProcessingService — job-based async processing for meetings
 *
 * Manages a queue of processing jobs, each going through status transitions:
 *   QUEUED → PROCESSING → TRANSCRIBING → SUMMARIZING → TASK_EXTRACTION → COMPLETED
 *                                                                        ↓
 *                                                                     FAILED
 *   Any state → CANCELLED
 *
 * Mock mode: uses in-memory store and setTimeout chains to simulate transitions.
 * API mode: would call backend endpoints that manage real SQS/Transcribe jobs.
 */

import { isApiMode, runtimeConfig } from '@/config/runtimeConfig';

import {
  JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
} from '@/domain/constants/costConstants';
import {
  createProcessingJob,
  transitionJob,
  statusProgress,
} from '@/domain/models/ProcessingJob';

// ─── In-memory job store ────────────────────────────────────────────
/** @type {Map<string, Object>} */
const _jobs = new Map();

/** @type {Map<string, NodeJS.Timeout[]>} */
const _timers = new Map();

// ─── Mock transition delays (ms) ────────────────────────────────────
const MOCK_STEP_DELAYS = {
  [JOB_STATUSES.QUEUED]: 2000,
  [JOB_STATUSES.PROCESSING]: 3000,
  [JOB_STATUSES.TRANSCRIBING]: 2000,
  [JOB_STATUSES.SUMMARIZING]: 2000,
  [JOB_STATUSES.TASK_EXTRACTION]: 1000,
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Create a new processing job for a meeting
 *
 * @param {Object} params
 * @param {string} params.meetingId
 * @param {string} params.workspaceId
 * @param {string} [params.createdBy]
 * @returns {Promise<{ job: Object, created: boolean }>}
 */
export async function createProcessingJobForMeeting({ meetingId, workspaceId, createdBy }) {
  if (!meetingId || !workspaceId) {
    throw new Error('meetingId and workspaceId are required');
  }

  const job = createProcessingJob({ meetingId, workspaceId, createdBy });
  _jobs.set(job.id, job);

  // In mock mode, auto-transition through stages
  if (!isApiMode()) {
    scheduleMockTransitions(job);
  }

  return { job, created: true };
}

/**
 * Get a job by its ID
 *
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
export async function getProcessingJobStatus(jobId) {
  if (!jobId) return null;

  if (!isApiMode()) {
    return _jobs.get(jobId) || null;
  }

  const response = await fetch(`${runtimeConfig.apiBaseUrl}/jobs/${jobId}`);
  if (!response.ok) return null;
  return response.json();
}

/**
 * Get the active job for a meeting (most recent non-terminal)
 *
 * @param {string} meetingId
 * @returns {Promise<Object|null>}
 */
export async function getJobByMeeting(meetingId) {
  if (!meetingId) return null;

  if (!isApiMode()) {
    const jobs = Array.from(_jobs.values())
      .filter((j) => j.meetingId === meetingId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return jobs[0] || null;
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/jobs/by-meeting/${meetingId}`
  );
  if (!response.ok) return null;
  return response.json();
}

/**
 * Get all active (non-terminal) jobs for a workspace
 *
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export async function getActiveJobs(workspaceId) {
  if (!workspaceId) return [];

  if (!isApiMode()) {
    return Array.from(_jobs.values()).filter(
      (j) =>
        j.workspaceId === workspaceId &&
        !TERMINAL_JOB_STATUSES.includes(j.status)
    );
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/jobs/active?workspaceId=${encodeURIComponent(workspaceId)}`
  );
  if (!response.ok) return [];
  return response.json();
}

/**
 * Get all jobs for a workspace (including terminal)
 *
 * @param {string} workspaceId
 * @returns {Promise<Array>}
 */
export async function getJobsByWorkspace(workspaceId) {
  if (!workspaceId) return [];

  if (!isApiMode()) {
    return Array.from(_jobs.values()).filter(
      (j) => j.workspaceId === workspaceId
    );
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/jobs?workspaceId=${encodeURIComponent(workspaceId)}`
  );
  if (!response.ok) return [];
  return response.json();
}

/**
 * Cancel a processing job
 *
 * @param {string} jobId
 * @returns {Promise<{ ok: boolean, job?: Object }>}
 */
export async function cancelProcessingJob(jobId) {
  if (!jobId) return { ok: false };

  if (!isApiMode()) {
    const job = _jobs.get(jobId);
    if (!job) return { ok: false };

    // Clear scheduled timers
    cancelMockTimers(jobId);

    const updated = transitionJob(job, JOB_STATUSES.CANCELLED);
    _jobs.set(jobId, updated);
    return { ok: true, job: updated };
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/jobs/${jobId}/cancel`,
    { method: 'POST' }
  );
  if (!response.ok) return { ok: false };
  const job = await response.json();
  return { ok: true, job };
}

/**
 * Retry a failed job (resets to QUEUED)
 *
 * @param {string} jobId
 * @returns {Promise<{ ok: boolean, job?: Object }>}
 */
export async function retryProcessingJob(jobId) {
  if (!jobId) return { ok: false };

  if (!isApiMode()) {
    const job = _jobs.get(jobId);
    if (!job || job.status !== JOB_STATUSES.FAILED) return { ok: false };

    const updated = transitionJob(job, JOB_STATUSES.QUEUED, {
      error: null,
    });
    _jobs.set(jobId, updated);

    // Restart mock transitions
    scheduleMockTransitions(updated);

    return { ok: true, job: updated };
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/jobs/${jobId}/retry`,
    { method: 'POST' }
  );
  if (!response.ok) return { ok: false };
  const job = await response.json();
  return { ok: true, job };
}

/**
 * Get all jobs (for testing / admin)
 *
 * @returns {Promise<Array>}
 */
export async function getAllJobs() {
  if (!isApiMode()) {
    return Array.from(_jobs.values());
  }
  const response = await fetch(`${runtimeConfig.apiBaseUrl}/jobs`);
  if (!response.ok) return [];
  return response.json();
}

/**
 * Clear all jobs and timers (for testing)
 */
export function resetJobs() {
  // Clear all timers
  for (const [jobId, timers] of _timers) {
    timers.forEach(clearTimeout);
  }
  _timers.clear();
  _jobs.clear();
}

// ─── Mock simulation ─────────────────────────────────────────────────

/**
 * Schedule mock status transitions for a job
 *
 * @param {Object} job
 */
function scheduleMockTransitions(job) {
  const timers = [];

  const steps = [
    { status: JOB_STATUSES.PROCESSING, delay: MOCK_STEP_DELAYS[JOB_STATUSES.QUEUED] },
    { status: JOB_STATUSES.TRANSCRIBING, delay: MOCK_STEP_DELAYS[JOB_STATUSES.PROCESSING] },
    { status: JOB_STATUSES.SUMMARIZING, delay: MOCK_STEP_DELAYS[JOB_STATUSES.TRANSCRIBING] },
    { status: JOB_STATUSES.TASK_EXTRACTION, delay: MOCK_STEP_DELAYS[JOB_STATUSES.SUMMARIZING] },
  ];

  let cumulativeDelay = 0;

  for (const step of steps) {
    cumulativeDelay += step.delay;
    const timer = setTimeout(() => {
      advanceJob(job.id, step.status);
    }, cumulativeDelay);
    timers.push(timer);
  }

  // Final transition to COMPLETED
  cumulativeDelay += MOCK_STEP_DELAYS[JOB_STATUSES.TASK_EXTRACTION];
  const completeTimer = setTimeout(() => {
    completeJob(job.id);
  }, cumulativeDelay);
  timers.push(completeTimer);

  _timers.set(job.id, timers);
}

/**
 * Advance job to a new status (internal)
 *
 * @param {string} jobId
 * @param {string} newStatus
 */
function advanceJob(jobId, newStatus) {
  const job = _jobs.get(jobId);
  if (!job) return;
  // Don't advance if cancelled or already terminal
  if (TERMINAL_JOB_STATUSES.includes(job.status)) return;

  const updated = transitionJob(job, newStatus, {
    progress: statusProgress(newStatus),
  });
  _jobs.set(jobId, updated);
}

/**
 * Complete a job with mock result (internal)
 *
 * @param {string} jobId
 */
function completeJob(jobId) {
  const job = _jobs.get(jobId);
  if (!job) return;
  if (TERMINAL_JOB_STATUSES.includes(job.status)) return;

  const mockResult = generateMockResult(job);
  const updated = transitionJob(job, JOB_STATUSES.COMPLETED, {
    result: mockResult,
    progress: 100,
  });
  _jobs.set(jobId, updated);
  _timers.delete(jobId);
}

/**
 * Generate a mock AI result for completed jobs
 *
 * @param {Object} job
 * @returns {Object}
 */
function generateMockResult(job) {
  return {
    summary: `Meeting #${job.meetingId.slice(0, 8)} has been analyzed successfully. Key discussion points include task assignments, deadline planning, and resource allocation.`,
    suggestedTasks: [
      {
        id: `task-mock-1-${Date.now()}`,
        title: 'Review API contract',
        description: 'Review and finalize the API contract for the AI meeting flow.',
        assignee: 'John Doe',
        assigneeId: 'u2',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        priority: 'HIGH',
        confidence: 0.85,
        approved: false,
      },
      {
        id: `task-mock-2-${Date.now()}`,
        title: 'Implement task extraction pipeline',
        description: 'Build the backend pipeline for AI-extracted task management.',
        assignee: 'Sarah Chen',
        assigneeId: 'u1',
        deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        priority: 'MEDIUM',
        confidence: 0.75,
        approved: false,
      },
    ],
  };
}
