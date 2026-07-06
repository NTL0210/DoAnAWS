import * as apiAdapter from '@/services/adapters/apiVoiceRecordingAdapter';
import {
  MAX_AI_AUDIO_SIZE_BYTES,
  WARNING_AI_AUDIO_SIZE_BYTES,
} from '@/domain/constants/costConstants';

export function canSendToAI(record) {
  if (!record) return { allowed: false, reason: 'No recording found.' };
  const size = record.sizeBytes || record.size || 0;
  if (size > MAX_AI_AUDIO_SIZE_BYTES) {
    return {
      allowed: false,
      reason: `Recording too large for AI processing. Maximum is ${Math.round(MAX_AI_AUDIO_SIZE_BYTES / (1024 * 1024))} MB.`,
    };
  }
  if (['PROCESSING', 'COMPLETED', 'SENT_TO_AI'].includes(record.aiStatus)) {
    return { allowed: false, reason: 'This recording has already been sent to AI.' };
  }
  return { allowed: true };
}

export function estimateAiCostForRecord(record) {
  const size = record?.sizeBytes || record?.size || 0;
  const sizeMB = size / (1024 * 1024);
  if (sizeMB < 10) return { estimatedCost: '~Low', estimatedCents: 1, warning: false };
  if (sizeMB < 100) return { estimatedCost: '~Medium', estimatedCents: 5, warning: false };
  return {
    estimatedCost: '~High',
    estimatedCents: 15,
    warning: size > WARNING_AI_AUDIO_SIZE_BYTES,
  };
}

export async function createVoiceRecord(recordData) {
  const blob = recordData.blob;
  if (!blob) throw new Error('Recording blob is missing.');

  const objectUrl = recordData.objectUrl || URL.createObjectURL(blob);
  const created = await apiAdapter.createVoiceRecord({
    workspaceId: recordData.workspaceId,
    channelId: recordData.channelId,
    title: recordData.title || `Voice Recording - ${new Date().toLocaleString()}`,
    fileName: recordData.fileName || `voice-recording-${Date.now()}.webm`,
    mimeType: recordData.mimeType || blob.type || 'audio/webm',
    sizeBytes: recordData.size || blob.size || 0,
    durationSeconds: recordData.duration || 0,
  });

  const uploaded = await apiAdapter.uploadVoiceRecord(created.id, blob);
  return {
    ...created,
    ...uploaded,
    objectUrl,
    url: objectUrl,
    sizeBytes: blob.size || uploaded.sizeBytes || created.sizeBytes || 0,
    size: blob.size || uploaded.sizeBytes || created.sizeBytes || 0,
    duration: recordData.duration || uploaded.durationSeconds || created.durationSeconds || 0,
    format: recordData.mimeType || blob.type || 'audio/webm',
    aiStatus: uploaded.aiStatus || created.aiStatus || 'NOT_SENT',
  };
}

export const getVoiceRecordsByChannel = (workspaceId, channelId) =>
  apiAdapter.getVoiceRecordsByChannel(workspaceId, channelId);

export const deleteVoiceRecord = (recordId) => apiAdapter.deleteVoiceRecord(recordId);

export async function uploadRecordToCloud(recordId, blob) {
  if (!blob) return { ok: false, error: 'Recording blob is missing.' };
  const record = await apiAdapter.uploadVoiceRecord(recordId, blob);
  return record?.id ? { ok: true, record, remoteId: record.id } : { ok: false, error: 'Upload failed.' };
}

export async function sendRecordToAiProcessing(recordId) {
  const result = await apiAdapter.sendVoiceRecordToAI(recordId);
  if (result?.meeting) return { ok: true, meeting: result.meeting, recording: result.recording };
  return { ok: false, error: 'AI processing request failed.' };
}

export const sendVoiceRecordToAI = sendRecordToAiProcessing;
