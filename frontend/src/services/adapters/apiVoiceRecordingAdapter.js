import cloudClient from '@/services/cloudClient';

const request = (path, options = {}) => cloudClient.request(path, options);

export const createVoiceRecord = (recordData) =>
  request('/voice-recordings', { method: 'POST', body: recordData });

export const uploadVoiceRecord = async (recordId, workspaceId, blob) => {
  const { uploadUrl, storageKey } = await request(`/voice-recordings/${recordId}/upload-url`, {
    method: 'POST',
    body: { workspaceId, contentType: blob?.type, sizeBytes: blob?.size },
  });
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: blob?.type ? { 'Content-Type': blob.type } : undefined,
  });
  if (!upload.ok) throw new Error('Voice recording upload failed');
  return request(`/voice-recordings/${recordId}`, {
    method: 'PATCH',
    body: { workspaceId, storageKey, status: 'READY', sizeBytes: blob?.size || 0 },
  });
};

export const getVoiceRecordsByChannel = (workspaceId, channelId) =>
  request(`/voice-recordings?workspaceId=${encodeURIComponent(workspaceId)}&channelId=${encodeURIComponent(channelId)}`);

export const deleteVoiceRecord = (recordId, workspaceId) =>
  request(`/voice-recordings/${recordId}`, { method: 'DELETE', params: { workspaceId } });

export const sendVoiceRecordToAI = (recordId, workspaceId) =>
  request(`/voice-recordings/${recordId}/send-to-ai`, {
    method: 'POST',
    body: { workspaceId },
  });
