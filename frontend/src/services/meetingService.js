/**
 * MeetingService — adapter pattern for meeting CRUD and AI analysis
 *
 * Supports two modes:
 *   api   → Next.js API routes
 *   cloud → API Gateway + Cognito
 *
 * In addition to the existing adapter methods, this service integrates
 * the meeting processing job lifecycle for async AI analysis.
 */

import { isApiMode, isCloudMode } from '@/config/runtimeConfig';
import { meetingsApi } from '@/services/cloudClient';
import * as apiAdapter from '@/services/adapters/apiMeetingAdapter';

export async function createMeeting(data) {
  if (isCloudMode()) return meetingsApi.create(data);
  return apiAdapter.createMeeting(data);
}

export async function uploadMeetingFile(file, metadata) {
  if (isCloudMode()) {
    return meetingsApi.create({ fileName: file?.name, fileType: file?.type, ...metadata });
  }
  return apiAdapter.uploadMeetingFile(file, metadata);
}

export async function analyzeMeeting(meetingOrId, context) {
  if (isCloudMode()) {
    const meetingId = typeof meetingOrId === 'string' ? meetingOrId : meetingOrId?.id;
    return meetingsApi.process(meetingId);
  }
  return apiAdapter.analyzeMeeting(meetingOrId, context);
}

export async function getMeetingById(meetingId) {
  if (isCloudMode()) return meetingsApi.get(meetingId);
  return apiAdapter.getMeetingById(meetingId);
}

export async function getMeetingsByWorkspace(workspaceId) {
  if (isCloudMode()) return meetingsApi.list({ workspaceId });
  return apiAdapter.getMeetingsByWorkspace(workspaceId);
}

export async function updateMeeting(meetingId, updates) {
  if (isCloudMode()) return meetingsApi.update(meetingId, updates);
  return apiAdapter.updateMeeting(meetingId, updates);
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
