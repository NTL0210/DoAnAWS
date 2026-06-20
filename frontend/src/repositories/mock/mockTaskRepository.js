/**
 * MockTaskRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/tasks.
 * NOTE: In mock/dev mode, data lives ONLY in memory (not localStorage).
 * When migrating to AWS, swap this repo for a DynamoDB-backed implementation
 * with ElastiCache (Redis) fronting for sub-3s latency.
 */

import { mockTasks } from '@/data/seed/tasks';

const DELAY_MS = 20;
const STORAGE_KEY = 'meetingAppMockTasks';
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function clearLegacyPersistedStore() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
}

function getStore() {
  if (!store) {
    clearLegacyPersistedStore();
    store = [...mockTasks];
  }
  return store;
}

export async function findById(id) {
  await delay();
  return getStore().find((t) => t.id === id) || null;
}

export async function findAll() {
  await delay();
  return getStore().map((t) => ({ ...t }));
}

export async function findByWorkspace(workspaceId) {
  await delay();
  return getStore().filter((t) => t.workspaceId === workspaceId || t.departmentId === workspaceId || !t.departmentId);
}

export async function findByDepartment(departmentId) {
  await delay();
  return getStore().filter((t) => t.departmentId === departmentId || t.workspaceId === departmentId);
}

export async function findByAssignee(assigneeId) {
  await delay();
  return getStore().filter((t) => t.assigneeId === assigneeId);
}

export async function findByMeeting(meetingId) {
  await delay();
  return getStore().filter((t) => t.sourceMeetingId === meetingId || t.meetingId === meetingId);
}

export async function findByStatus(workspaceId, status) {
  await delay();
  return getStore().filter((t) => (t.workspaceId === workspaceId || t.departmentId === workspaceId) && t.status === status);
}

export async function findOverdue(workspaceId) {
  await delay();
  const now = new Date();
  return getStore().filter((t) => {
    if (!t.deadline) return false;
    const wsMatch = t.workspaceId === workspaceId || t.departmentId === workspaceId;
    const notDone = t.status !== 'COMPLETED' && t.status !== 'CANCELLED';
    return wsMatch && notDone && new Date(t.deadline) < now;
  });
}

export async function create(data) {
  await delay();
  const now = new Date().toISOString();
  const task = {
    id: data.id || 'task-' + Date.now().toString(36),
    workspaceId: data.workspaceId || data.departmentId || null,
    teamId: data.teamId || null,
    meetingId: data.meetingId || data.sourceMeetingId || null,
    sourceMeetingId: data.sourceMeetingId || data.meetingId || null,
    title: data.title || '',
    description: data.description || '',
    assigneeId: data.assigneeId || null,
    status: data.status || 'TODO',
    priority: data.priority || 'MEDIUM',
    deadline: data.deadline || null,
    progress: data.progress || 0,
    generatedFromAI: Boolean(data.generatedFromAI),
    aiConfidence: data.aiConfidence ?? null,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || now,
    updatedAt: null,
  };
  getStore().unshift(task);
  return { ...task };
}

export async function update(id, data) {
  await delay();
  const s = getStore();
  const idx = s.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  s[idx] = { ...s[idx], ...data, updatedAt: now };
  return { ...s[idx] };
}

export async function delete_(id) {
  await delay();
  const s = getStore();
  const idx = s.findIndex((t) => t.id === id);
  if (idx !== -1) s.splice(idx, 1);
}

export default { findById, findAll, findByWorkspace, findByDepartment, findByAssignee, findByMeeting, findByStatus, findOverdue, create, update, delete_ };
