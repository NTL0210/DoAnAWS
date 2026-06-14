/**
 * MockMeetingRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/meetings
 */

import { mockWorkspaceMeetings } from '@/data/seed/meetings';

const DELAY_MS = 30;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function getStore() {
  if (!store) store = JSON.parse(JSON.stringify(mockWorkspaceMeetings));
  return store;
}

export async function findById(id) {
  await delay();
  const found = getStore().find((m) => m.id === id);
  return found ? JSON.parse(JSON.stringify(found)) : null;
}

export async function findByWorkspace(workspaceId) {
  await delay();
  return getStore()
    .filter((m) => m.workspaceId === workspaceId)
    .map((m) => JSON.parse(JSON.stringify(m)));
}

export async function findRecentByWorkspace(workspaceId, limit = 10) {
  await delay();
  return getStore()
    .filter((m) => m.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map((m) => JSON.parse(JSON.stringify(m)));
}

export async function create(data) {
  await delay();
  const now = new Date().toISOString();
  const meeting = {
    id: data.id || 'meeting-' + Date.now().toString(36),
    workspaceId: data.workspaceId,
    teamId: data.teamId || null,
    title: data.title || '',
    type: data.type || 'TRANSCRIPT',
    status: data.status || 'UPLOADED',
    fileName: data.fileName || null,
    audioFile: data.audioFile || null,
    storageKey: data.storageKey || null,
    transcript: data.transcript || '',
    transcriptText: data.transcriptText || data.transcript || '',
    participantIds: data.participantIds || [],
    aiSummary: data.aiSummary || '',
    summary: data.summary || '',
    keyDecisions: data.keyDecisions || [],
    actionItems: data.actionItems || [],
    risks: data.risks || [],
    suggestedTasks: data.suggestedTasks || [],
    generatedTaskIds: data.generatedTaskIds || [],
    processingJobId: data.processingJobId || null,
    processingError: data.processingError || null,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  getStore().unshift(meeting);
  return JSON.parse(JSON.stringify(meeting));
}

export async function update(id, data) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  store[idx] = { ...store[idx], ...data, updatedAt: now };
  return JSON.parse(JSON.stringify(store[idx]));
}

export async function delete_(id) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((m) => m.id === id);
  if (idx !== -1) store.splice(idx, 1);
}

export default { findById, findByWorkspace, findRecentByWorkspace, create, update, delete_ };
