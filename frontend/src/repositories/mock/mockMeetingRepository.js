/**
 * MockMeetingRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/meetings.
 * NOTE: In mock/dev mode, data lives ONLY in memory (not localStorage).
 * When migrating to AWS, swap this repo for a DynamoDB-backed implementation
 * with ElastiCache (Redis) fronting for sub-3s latency.
 */

import { mockWorkspaceMeetings } from '@/data/seed/meetings';

const DELAY_MS = 20;
const STORAGE_KEY = 'meetingAppMockMeetings';
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clearLegacyPersistedStore() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
}

function getStore() {
  if (!store) {
    clearLegacyPersistedStore();
    store = cloneDeep(mockWorkspaceMeetings);
  }
  return store;
}

export async function findById(id) {
  await delay();
  const found = getStore().find((m) => m.id === id);
  return found ? cloneDeep(found) : null;
}

export async function findAll() {
  await delay();
  return getStore().map((m) => cloneDeep(m));
}

export async function findByWorkspace(workspaceId) {
  await delay();
  return getStore()
    .filter((m) => m.workspaceId === workspaceId)
    .map((m) => cloneDeep(m));
}

export async function findByDepartment(departmentId) {
  await delay();
  return getStore()
    .filter((m) => m.departmentId === departmentId)
    .map((m) => cloneDeep(m));
}

export async function findRecentByWorkspace(workspaceId, limit = 10) {
  await delay();
  return getStore()
    .filter((m) => m.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map((m) => cloneDeep(m));
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
  return cloneDeep(meeting);
}

export async function update(id, data) {
  await delay();
  const s = getStore();
  const idx = s.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  s[idx] = { ...s[idx], ...data, updatedAt: now };
  return cloneDeep(s[idx]);
}

export async function delete_(id) {
  await delay();
  const s = getStore();
  const idx = s.findIndex((m) => m.id === id);
  if (idx !== -1) s.splice(idx, 1);
}

export default { findById, findAll, findByWorkspace, findByDepartment, findRecentByWorkspace, create, update, delete_ };
