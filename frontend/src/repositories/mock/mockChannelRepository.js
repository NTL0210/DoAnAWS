/**
 * MockChannelRepository — in-memory mock implementation
 *
 * Channels are stored inside workspace objects.
 */

const DELAY_MS = 30;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let wsStore = null;

function getWorkspaces() {
  if (!wsStore) {
    wsStore = require('@/repositories/mock/mockWorkspaceRepository');
  }
  return wsStore;
}

export async function findById(workspaceId, channelId) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return null;
  return ws.channels.find((c) => c.id === channelId) || null;
}

export async function findByWorkspace(workspaceId) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  return ws ? ws.channels : [];
}

export async function create(workspaceId, data) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return null;
  const now = new Date().toISOString();
  const channel = {
    id: data.id || 'ch-' + Date.now().toString(36),
    name: data.name || '',
    type: data.type || 'text',
    description: data.description || '',
    isDefault: Boolean(data.isDefault),
    scope: data.scope || 'WORKSPACE',
    teamId: data.teamId || null,
    allowedTeamIds: data.allowedTeamIds || [],
    allowedUserIds: data.allowedUserIds || [],
    deniedUserIds: data.deniedUserIds || [],
    isLocked: Boolean(data.isLocked),
    allowRecording: data.allowRecording !== false,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  ws.channels.push(channel);
  await getWorkspaces().update(workspaceId, { channels: ws.channels });
  return { ...channel };
}

export async function update(workspaceId, channelId, data) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return null;
  const idx = ws.channels.findIndex((c) => c.id === channelId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  ws.channels[idx] = { ...ws.channels[idx], ...data, updatedAt: now };
  await getWorkspaces().update(workspaceId, { channels: ws.channels });
  return { ...ws.channels[idx] };
}

export async function delete_(workspaceId, channelId) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return;
  ws.channels = ws.channels.filter((c) => c.id !== channelId);
  await getWorkspaces().update(workspaceId, { channels: ws.channels });
}

export default { findById, findByWorkspace, create, update, delete_ };
