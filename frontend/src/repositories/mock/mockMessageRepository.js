/**
 * MockMessageRepository — in-memory mock implementation
 *
 * Uses seed data from @/data/seed/messages
 */

import { mockMessages as seedMessages } from '@/data/seed/messages';

const DELAY_MS = 20;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let store = null;

function getStore() {
  if (!store) {
    store = {};
    for (const [key, msgs] of Object.entries(seedMessages)) {
      store[key] = msgs.map((m) => ({ ...m }));
    }
  }
  return store;
}

export async function findByChannel(channelId) {
  await delay();
  return [...(getStore()[channelId] || [])];
}

export async function findByTeamChat(teamChatKey) {
  await delay();
  return [...(getStore()[teamChatKey] || [])];
}

export async function create(data) {
  await delay();
  const now = new Date().toISOString();
  const msg = {
    id: data.id || 'msg-' + Date.now().toString(36),
    channelId: data.channelId,
    workspaceId: data.workspaceId,
    userId: data.userId,
    content: data.content || '',
    attachments: data.attachments || [],
    teamId: data.teamId || null,
    scope: data.scope || null,
    system: Boolean(data.system),
    createdAt: data.createdAt || now,
    updatedAt: null,
  };

  const key = msg.channelId || (msg.teamId ? 'team-chat-' + msg.teamId : null);
  if (key) {
    const store = getStore();
    if (!store[key]) store[key] = [];
    store[key].push(msg);
  }
  return { ...msg };
}

export async function delete_(messageId) {
  await delay();
  const store = getStore();
  for (const key of Object.keys(store)) {
    const idx = store[key].findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      store[key].splice(idx, 1);
      return;
    }
  }
}

export default { findByChannel, findByTeamChat, create, delete_ };
