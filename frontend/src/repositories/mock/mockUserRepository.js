/**
 * MockUserRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/users.
 * NOTE: In mock/dev mode, data lives ONLY in memory (not localStorage).
 * When migrating to AWS, swap this repo for a DynamoDB-backed implementation
 * with ElastiCache (Redis) fronting for sub-3s latency.
 */

import { mockUsers } from '@/data/seed/users';

const DELAY_MS = 30;
const STORAGE_KEY = 'meetingAppMockUsers';
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function cloneUsers(users) {
  return users.map((user) => ({ ...user }));
}

/**
 * Persist the in-memory store to localStorage so registered users
 * survive page reload. This ensures login-after-refresh works
 * even in mock mode.
 */
function persistToStorage() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getStore()));
  } catch {
    // Best-effort — localStorage may be full or unavailable
  }
}

/**
 * Restore store from localStorage on initialization.
 * Falls back to seed data if nothing is stored.
 */
function loadFromStorage() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        store = parsed;
        return true;
      }
    }
  } catch {
    // Best-effort
  }
  return false;
}

function getStore() {
  if (!store) {
    if (!loadFromStorage()) {
      store = cloneUsers(mockUsers);
    }
  }
  return store;
}

export async function findById(id) {
  await delay();
  return getStore().find((u) => u.id === id) || null;
}

export async function findByEmail(email) {
  await delay();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return getStore().find((u) => String(u.email || '').toLowerCase() === normalizedEmail) || null;
}

export async function findAll() {
  await delay();
  return [...getStore()];
}

export async function create(data) {
  await delay();
  const now = new Date().toISOString();
  const user = {
    id: data.id || 'user-' + Date.now().toString(36),
    name: data.name || '',
    email: data.email || '',
    password: data.password || '123456',
    avatar: data.avatar || null,
    phone: data.phone || '',
    avatarHistory: data.avatarHistory || [],
    role: data.role || 'EMPLOYEE',
    departmentId: data.departmentId || null,
    createdAt: data.createdAt || now,
  };
  getStore().push(user);
  persistToStorage();
  return { ...user };
}

export async function update(id, data) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...data };
  persistToStorage();
  return { ...store[idx] };
}

export async function delete_(id) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((u) => u.id === id);
  if (idx !== -1) {
    store.splice(idx, 1);
    persistToStorage();
  }
}

export default { findById, findByEmail, findAll, create, update, delete_ };
