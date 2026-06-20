/**
 * MockNotificationRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/notifications
 */

import { mockNotifications } from '@/data/seed/notifications';

const DELAY_MS = 20;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function getStore() {
  if (!store) store = [...mockNotifications.map((n) => ({ ...n }))];
  return store;
}

export async function findByUser(userId) {
  await delay();
  return getStore()
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function findById(id) {
  await delay();
  return getStore().find((n) => n.id === id) || null;
}

export async function findUnreadByUser(userId) {
  await delay();
  return getStore().filter((n) => n.userId === userId && !n.isRead);
}

export async function create(data) {
  await delay();
  const now = new Date().toISOString();
  const notification = {
    id: data.id || 'ntf-' + Date.now().toString(36),
    userId: data.userId || null,
    title: data.title || '',
    message: data.message || '',
    type: data.type || 'TASK_ASSIGNED',
    isRead: Boolean(data.isRead),
    workspaceId: data.workspaceId || null,
    meetingId: data.meetingId || null,
    taskId: data.taskId || null,
    teamId: data.teamId || null,
    createdAt: data.createdAt || now,
  };
  getStore().unshift(notification);
  return { ...notification };
}

export async function markAsRead(id) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((n) => n.id === id);
  if (idx !== -1) {
    store[idx].isRead = true;
    return { ...store[idx] };
  }
  return null;
}

export async function markAllAsRead(userId) {
  await delay();
  const store = getStore();
  store.forEach((n) => {
    if (n.userId === userId) n.isRead = true;
  });
}

export default { findByUser, findById, findUnreadByUser, create, markAsRead, markAllAsRead };
