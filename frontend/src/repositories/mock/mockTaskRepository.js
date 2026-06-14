/**
 * MockTaskRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/tasks
 */

import { mockTasks } from '@/data/seed/tasks';

const DELAY_MS = 30;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function getStore() {
  if (!store) store = [...mockTasks];
  return store;
}

export async function findById(id) {
  await delay();
  return getStore().find((t) => t.id === id) || null;
}

export async function findByWorkspace(workspaceId) {
  await delay();
  return getStore().filter((t) => t.workspaceId === workspaceId || t.departmentId === workspaceId || !t.departmentId);
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
  const store = getStore();
  const idx = store.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  store[idx] = { ...store[idx], ...data, updatedAt: now };
  return { ...store[idx] };
}

export async function delete_(id) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((t) => t.id === id);
  if (idx !== -1) store.splice(idx, 1);
}

export default { findById, findByWorkspace, findByAssignee, findByMeeting, findByStatus, findOverdue, create, update, delete_ };
