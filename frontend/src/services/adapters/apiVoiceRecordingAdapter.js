import { runtimeConfig } from '@/config/runtimeConfig';

async function request(path, options = {}) {
  const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error('Voice recording API request failed');
  return response.json();
}

export const createVoiceRecord = (recordData) =>
  request('/voice-recordings', { method: 'POST', body: JSON.stringify(recordData) });

export const uploadVoiceRecord = async (recordId, blob) => {
  const { uploadUrl, storageKey } = await request(`/voice-recordings/${recordId}/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ contentType: blob?.type, sizeBytes: blob?.size }),
  });
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: blob?.type ? { 'Content-Type': blob.type } : undefined,
  });
  if (!upload.ok) throw new Error('Voice recording upload failed');
  return request(`/voice-recordings/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ storageKey, status: 'READY' }),
  });
};

export const getVoiceRecordsByChannel = (workspaceId, channelId) =>
  request(`/voice-recordings?workspaceId=${encodeURIComponent(workspaceId)}&channelId=${encodeURIComponent(channelId)}`);

export const deleteVoiceRecord = (recordId) =>
  request(`/voice-recordings/${recordId}`, { method: 'DELETE' });

export const sendVoiceRecordToAI = (recordId) =>
  request(`/voice-recordings/${recordId}/send-to-ai`, { method: 'POST' });
