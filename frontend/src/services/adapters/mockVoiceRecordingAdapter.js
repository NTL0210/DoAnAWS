import { generateId } from '@/services/workspaceService';
import { sanitizeVoiceFileName, SUPPORTED_VOICE_AUDIO_TYPES } from '@/lib/voicePermissions';

let records = [];

export async function createVoiceRecord(recordData) {
  const now = new Date().toISOString();
  const record = {
    id: recordData.id || 'vr-' + generateId(),
    description: '',
    storageKey: null,
    downloadUrl: null,
    status: 'READY',
    aiStatus: 'NOT_SENT',
    sourceMeetingId: null,
    autoStopped: false,
    createdAt: now,
    updatedAt: now,
    ...recordData,
    fileName: sanitizeVoiceFileName(recordData.fileName || 'voice-recording.webm'),
  };
  records = [record, ...records];
  return record;
}

export async function uploadVoiceRecord(recordId, blob) {
  if (blob?.type && !SUPPORTED_VOICE_AUDIO_TYPES.some((type) => blob.type.startsWith(type))) {
    throw new Error('Unsupported audio file type');
  }
  records = records.map((record) =>
    record.id === recordId
      ? { ...record, sizeBytes: blob?.size || record.sizeBytes || 0, updatedAt: new Date().toISOString() }
      : record
  );
  return records.find((record) => record.id === recordId) || null;
}

export async function getVoiceRecordsByChannel(workspaceId, channelId) {
  return records.filter((record) => record.workspaceId === workspaceId && record.channelId === channelId);
}

export async function deleteVoiceRecord(recordId) {
  records = records.map((record) =>
    record.id === recordId ? { ...record, status: 'DELETED', updatedAt: new Date().toISOString() } : record
  );
  return true;
}

export async function sendVoiceRecordToAI(recordId) {
  const now = new Date().toISOString();
  records = records.map((record) =>
    record.id === recordId ? { ...record, aiStatus: 'SENT_TO_AI', updatedAt: now } : record
  );
  return records.find((record) => record.id === recordId) || null;
}
