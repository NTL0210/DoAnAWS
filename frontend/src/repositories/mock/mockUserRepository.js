/**
 * MockUserRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/users
 */

import { mockUsers } from '@/data/seed/users';

const DELAY_MS = 30;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function getStore() {
  if (!store) store = [...mockUsers];
  return store;
}

export async function findById(id) {
  await delay();
  return getStore().find((u) => u.id === id) || null;
}

export async function findByEmail(email) {
  await delay();
  return getStore().find((u) => u.email === email) || null;
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
    createdAt: data.createdAt || now,
  };
  getStore().push(user);
  return { ...user };
}

export async function update(id, data) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...data };
  return { ...store[idx] };
}

export async function delete_(id) {
  await delay();
  const store = getStore();
  const idx = store.findIndex((u) => u.id === id);
  if (idx !== -1) store.splice(idx, 1);
}

export default { findById, findByEmail, findAll, create, update, delete_ };
