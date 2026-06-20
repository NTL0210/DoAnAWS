/**
 * MockWorkspaceRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/workspaces.
 * NOTE: In mock/dev mode, data lives ONLY in memory (not localStorage).
 * When migrating to AWS, swap this repo for a DynamoDB-backed implementation
 * with ElastiCache (Redis) fronting for sub-3s latency.
 */

import { workspaces as seedWorkspaces, userWorkspaces as seedUserWorkspaces } from '@/data/seed/workspaces';
import { DEFAULT_FEATURES } from '@/data/defaults/features';

const DELAY_MS = 20;
const STORAGE_KEY = 'meetingAppMockWorkspaces';
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
    store = seedWorkspaces.map((ws) => ({ ...ws, channels: [...ws.channels], teams: [...ws.teams], members: [...ws.members] }));
  }
  return store;
}

export async function findById(id) {
  await delay();
  const ws = getStore().find((w) => w.id === id);
  return ws ? cloneDeep(ws) : null;
}

export async function findByUserId(userId) {
  await delay();
  const all = getStore();
  const seedIds = seedUserWorkspaces[userId] || [];
  return all
    .filter((ws) => seedIds.includes(ws.id) || ws.members?.some((m) => m.userId === userId))
    .map(cloneDeep);
}

export async function findAll() {
  await delay();
  return getStore().map(cloneDeep);
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
  return cloneDeep(ws);
}

export async function update(id, data) {
  await delay();
  const s = getStore();
  const idx = s.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  s[idx] = { ...s[idx], ...data, updatedAt: now };
  return cloneDeep(s[idx]);
}

export async function delete_(id) {
  await delay();
  const s = getStore();
  const idx = s.findIndex((w) => w.id === id);
  if (idx !== -1) s.splice(idx, 1);
}

export default { findById, findByUserId, findAll, create, update, delete_ };
