/**
 * MockWorkspaceRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/workspaces
 * Simulates async DB operations with Promise + short delay.
 */

import { workspaces as seedWorkspaces, userWorkspaces as seedUserWorkspaces } from '@/data/seed/workspaces';
import { DEFAULT_FEATURES } from '@/data/defaults/features';

const DELAY_MS = 50;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

/** In-memory store (cloned from seed on first access) */
let store = null;

function getStore() {
  if (!store) {
    store = seedWorkspaces.map((ws) => ({ ...ws, channels: [...ws.channels], teams: [...ws.teams], members: [...ws.members] }));
  }
  return store;
}

function cloneWorkspace(ws) {
  return JSON.parse(JSON.stringify(ws));
}

export async function findById(id) {
  await delay();
  const ws = getStore().find((w) => w.id === id);
  return ws ? cloneWorkspace(ws) : null;
}

export async function findByUserId(userId) {
  await delay();
  const ids = seedUserWorkspaces[userId] || [];
  return getStore()
    .filter((ws) => ids.includes(ws.id))
    .map(cloneWorkspace);
}

export async function findAll() {
  await delay();
  return getStore().map(cloneWorkspace);
}

export async function create(data) {
  await delay();
  const now = new Date().toISOString();
  const ws = {
    id: data.id,
    name: data.name || '',
    description: data.description || '',
    iconColor: data.iconColor || 'blue',
    workspaceType: data.workspaceType || 'blank',
    visibility: data.visibility || 'private',
    slug: data.slug || '',
    ownerId: data.ownerId || '',
    memberIds: data.memberIds || [],
    channels: data.channels || [],
    teams: data.teams || [],
    members: data.members || [],
    tasks: data.tasks || [],
    meetings: data.meetings || [],
    messages: data.messages || {},
    notifications: data.notifications || [],
    invitations: data.invitations || [],
    voiceRecords: data.voiceRecords || [],
    customRoles: data.customRoles || [],
    features: data.features || DEFAULT_FEATURES.map((f) => ({ ...f })),
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
  getStore().push(ws);
  return cloneWorkspace(ws);
}

export async function update(id, data) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  store[idx] = { ...store[idx], ...data, updatedAt: now };
  return cloneWorkspace(store[idx]);
}

export async function delete_(id) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((w) => w.id === id);
  if (idx !== -1) store.splice(idx, 1);
}

export default { findById, findByUserId, findAll, create, update, delete_ };
