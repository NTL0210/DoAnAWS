/**
 * MeetingService — adapter pattern for meeting CRUD and AI analysis
 *
 * In addition to the existing adapter methods, this service integrates
 * the meeting processing job lifecycle for async AI analysis.
 */

import { isApiMode } from '@/config/runtimeConfig';
import * as mockAdapter from '@/services/adapters/mockMeetingAdapter';
import * as apiAdapter from '@/services/adapters/apiMeetingAdapter';

const adapter = isApiMode() ? apiAdapter : mockAdapter;

export const createMeeting = (data) => adapter.createMeeting(data);
export const uploadMeetingFile = (file, metadata) => adapter.uploadMeetingFile(file, metadata);
export const analyzeMeeting = (meetingOrId, context) => adapter.analyzeMeeting(meetingOrId, context);
export const getMeetingById = (meetingId) => adapter.getMeetingById(meetingId);
export const getMeetingsByWorkspace = (workspaceId) => adapter.getMeetingsByWorkspace(workspaceId);
export const updateMeeting = (meetingId, updates) => adapter.updateMeeting(meetingId, updates);

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
