/**
 * MeetingService — adapter pattern for meeting CRUD and AI analysis
 *
 * Supports three modes:
 *   mock  → localStorage via mock repository
 *   api   → Next.js API routes
 *   cloud → API Gateway + Cognito
 *
 * In addition to the existing adapter methods, this service integrates
 * the meeting processing job lifecycle for async AI analysis.
 */

import { isApiMode, isCloudMode, isMockMode } from '@/config/runtimeConfig';
import { meetingsApi } from '@/services/cloudClient';
import * as mockAdapter from '@/services/adapters/mockMeetingAdapter';
import * as apiAdapter from '@/services/adapters/apiMeetingAdapter';

function resolveAdapter() {
  if (isCloudMode()) return 'CLOUD';
  if (isApiMode()) return 'API';
  return 'MOCK';
}

export async function createMeeting(data) {
  if (isCloudMode()) return meetingsApi.create(data);
  if (isApiMode()) return apiAdapter.createMeeting(data);
  return mockAdapter.createMeeting(data);
}

export async function uploadMeetingFile(file, metadata) {
  if (isCloudMode()) {
    // Get a signed upload URL from API Gateway, then upload to S3 directly
    // For now, store the metadata and let the backend handle S3
    return meetingsApi.create({ fileName: file?.name, fileType: file?.type, ...metadata });
  }
  if (isApiMode()) return apiAdapter.uploadMeetingFile(file, metadata);
  return mockAdapter.uploadMeetingFile(file, metadata);
}

export async function analyzeMeeting(meetingOrId, context) {
  if (isCloudMode()) {
    const meetingId = typeof meetingOrId === 'string' ? meetingOrId : meetingOrId?.id;
    return meetingsApi.process(meetingId);
  }
  if (isApiMode()) return apiAdapter.analyzeMeeting(meetingOrId, context);
  return mockAdapter.analyzeMeeting(meetingOrId, context);
}

export async function getMeetingById(meetingId) {
  if (isCloudMode()) return meetingsApi.get(meetingId);
  if (isApiMode()) return apiAdapter.getMeetingById(meetingId);
  return mockAdapter.getMeetingById(meetingId);
}

export async function getMeetingsByWorkspace(workspaceId) {
  if (isCloudMode()) return meetingsApi.list({ workspaceId });
  if (isApiMode()) return apiAdapter.getMeetingsByWorkspace(workspaceId);
  return mockAdapter.getMeetingsByWorkspace(workspaceId);
}

export async function updateMeeting(meetingId, updates) {
  if (isCloudMode()) return meetingsApi.update(meetingId, updates);
  if (isApiMode()) return apiAdapter.updateMeeting(meetingId, updates);
  return mockAdapter.updateMeeting(meetingId, updates);
}

/**
 * Analyze a meeting with AI — wraps analyzeMeeting to optionally
 * create a processing job for async tracking.
 *
 * @param {Object|string} meetingOrId
 * @param {Object} [context={}]
 * @param {boolean} [context.createJob=false] — if true, creates a processing job
 * @returns {Promise<Object>} analysis result
 */
export async function analyzeMeetingWithJob(meetingOrId, context = {}) {
  if (context.createJob) {
    const { createProcessingJobForMeeting } = await import(
      '@/services/meetingProcessingService'
    );
    const meetingId = typeof meetingOrId === 'object' ? meetingOrId.id : meetingOrId;
    await createProcessingJobForMeeting({
      meetingId,
      workspaceId: context.workspaceId || context.teamId || 'workspace-default',
      createdBy: context.userId || 'system',
    });
  }

  return analyzeMeeting(meetingOrId, context);
}
