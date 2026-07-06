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

import { isCloudMode } from '@/config/runtimeConfig';
import { meetingsApi } from '@/services/cloudClient';

export async function createMeeting(data) {
  if (!isCloudMode()) throw new Error('Cloud API mode is required.');
  return meetingsApi.create(data);
}

export async function uploadMeetingFile(meetingId, file, metadata = {}) {
  if (isCloudMode()) {
    const { uploadUrl, storageKey, meeting } = await meetingsApi.createUploadUrl(
      meetingId,
      {
        fileName: file?.name || 'meeting-file',
        contentType: file?.type || 'application/octet-stream',
        fileSize: file?.size || 0,
      },
      { workspaceId: metadata.workspaceId }
    );
    const upload = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: file?.type ? { 'Content-Type': file.type } : undefined,
    });
    if (!upload.ok) throw new Error('Meeting file upload failed.');
    return meeting || { storageRef: storageKey };
  }
  throw new Error('Cloud API mode is required.');
}

export async function analyzeMeeting(meetingOrId, context) {
  if (!isCloudMode()) throw new Error('Cloud API mode is required.');
  const meetingId = typeof meetingOrId === 'string' ? meetingOrId : meetingOrId?.id;
  return meetingsApi.process(meetingId, { workspaceId: context?.workspaceId });
}

export async function getMeetingById(meetingId) {
  if (!isCloudMode()) throw new Error('Cloud API mode is required.');
  return meetingsApi.get(meetingId);
}

export async function getMeetingsByWorkspace(workspaceId) {
  if (!isCloudMode()) throw new Error('Cloud API mode is required.');
  return meetingsApi.list({ workspaceId });
}

export async function updateMeeting(meetingId, updates) {
  if (!isCloudMode()) throw new Error('Cloud API mode is required.');
  return meetingsApi.update(meetingId, updates);
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
