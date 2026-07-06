import { meetingsApi } from '@/services/cloudClient';
import {
  JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
} from '@/domain/constants/costConstants';

export async function createProcessingJobForMeeting({ meetingId, workspaceId, createdBy }) {
  if (!meetingId || !workspaceId) {
    throw new Error('meetingId and workspaceId are required');
  }
  const meeting = await meetingsApi.process(meetingId, { workspaceId });
  return {
    job: meetingToJob(meeting, { createdBy }),
    created: true,
  };
}

export async function getProcessingJobStatus(jobId) {
  if (!jobId) return null;
  return null;
}

export async function getJobByMeeting(meetingId, workspaceId) {
  if (!meetingId || !workspaceId) return null;
  const meeting = await meetingsApi.get(meetingId, { workspaceId });
  return meetingToJob(meeting);
}

export async function getActiveJobs() {
  return [];
}

export async function getJobsByWorkspace() {
  return [];
}

export async function cancelProcessingJob() {
  return { ok: false };
}

export async function retryProcessingJob() {
  return { ok: false };
}

export async function getAllJobs() {
  return [];
}

export function resetJobs() {
  return undefined;
}

function meetingToJob(meeting, extra = {}) {
  if (!meeting) return null;
  const status = meetingStatusToJobStatus(meeting.status);
  return {
    id: meeting.id,
    meetingId: meeting.id,
    workspaceId: meeting.workspaceId,
    status,
    progress: statusToProgress(status),
    result: TERMINAL_JOB_STATUSES.includes(status) ? meeting : null,
    error: meeting.status === 'FAILED' ? 'Processing failed.' : null,
    createdBy: extra.createdBy || meeting.createdBy || null,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  };
}

function meetingStatusToJobStatus(status) {
  if (status === 'PROCESSING') return JOB_STATUSES.PROCESSING;
  if (status === 'AI_REVIEW_READY' || status === 'TASKS_GENERATED' || status === 'COMPLETED') {
    return JOB_STATUSES.COMPLETED;
  }
  if (status === 'FAILED') return JOB_STATUSES.FAILED;
  return JOB_STATUSES.QUEUED;
}

function statusToProgress(status) {
  if (status === JOB_STATUSES.COMPLETED) return 100;
  if (status === JOB_STATUSES.FAILED) return 100;
  if (status === JOB_STATUSES.PROCESSING) return 60;
  return 10;
}
