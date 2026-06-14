import { runtimeConfig } from '@/config/runtimeConfig';

async function request(path, options = {}) {
  const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export function createMeeting(data) {
  return request('/meetings', { method: 'POST', body: JSON.stringify(data) });
}

export function uploadMeetingFile(file, metadata = {}) {
  return request('/meetings/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      ...metadata,
    }),
  });
}

export function analyzeMeeting(meetingOrId) {
  const meetingId = typeof meetingOrId === 'string' ? meetingOrId : meetingOrId?.id;
  return request(`/meetings/${meetingId}/analyze`, { method: 'POST' });
}

export function getMeetingById(meetingId) {
  return request(`/meetings/${meetingId}`);
}

export function getMeetingsByWorkspace(workspaceId) {
  return request(`/workspaces/${workspaceId}/meetings`);
}

export function updateMeeting(meetingId, updates) {
  return request(`/meetings/${meetingId}`, { method: 'PATCH', body: JSON.stringify(updates) });
}
