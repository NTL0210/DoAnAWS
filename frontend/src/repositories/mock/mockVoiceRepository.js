/**
 * MockVoiceRepository — in-memory mock implementation
 */

const DELAY_MS = 20;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let records = [];

export async function createVoiceRecord(data) {
  await delay();
  const now = new Date().toISOString();
  const record = {
    id: data.id || 'vr-' + Date.now().toString(36),
    workspaceId: data.workspaceId,
    channelId: data.channelId,
    teamId: data.teamId || null,
    title: data.title || '',
    recordedBy: data.recordedBy || '',
    participantIds: data.participantIds || [],
    durationSeconds: data.durationSeconds || 0,
    sizeBytes: data.sizeBytes || 0,
    format: data.format || 'audio/webm',
    fileName: data.fileName || 'voice-recording.webm',
    objectUrl: data.objectUrl || null,
    storageKey: data.storageKey || null,
    downloadUrl: data.downloadUrl || null,
    status: data.status || 'READY',
    aiStatus: data.aiStatus || 'NOT_SENT',
    sourceMeetingId: data.sourceMeetingId || null,
    autoStopped: Boolean(data.autoStopped),
    description: data.description || '',
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  records.unshift(record);
  return { ...record };
}

export async function updateVoiceRecord(recordId, updates) {
  await delay();
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  records[idx] = { ...records[idx], ...updates, updatedAt: now };
  return { ...records[idx] };
}

export async function findByChannel(workspaceId, channelId) {
  await delay();
  return records.filter((r) => r.workspaceId === workspaceId && r.channelId === channelId);
}

export async function deleteVoiceRecord(recordId) {
  await delay();
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx !== -1) {
    records[idx] = { ...records[idx], status: 'DELETED', updatedAt: new Date().toISOString() };
  }
  return true;
}

export default { createVoiceRecord, updateVoiceRecord, findByChannel, deleteVoiceRecord };
