/**
 * MockTeamRepository — in-memory mock implementation
 *
 * Teams are stored inside workspace objects.
 */

const DELAY_MS = 30;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

let wsStore = null;

// Lazy reference to workspace store
function getWorkspaces() {
  if (!wsStore) {
    // Import lazily to avoid circular dependency
    wsStore = require('@/repositories/mock/mockWorkspaceRepository');
  }
  return wsStore;
}

export async function findById(workspaceId, teamId) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return null;
  return ws.teams.find((t) => t.id === teamId) || null;
}

export async function findByWorkspace(workspaceId) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  return ws ? ws.teams : [];
}

export async function create(workspaceId, data) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return null;
  const now = new Date().toISOString();
  const team = {
    id: data.id || workspaceId + '-team-' + Date.now().toString(36),
    workspaceId,
    name: data.name || '',
    description: data.description || '',
    color: data.color || '#5865F2',
    managerId: data.managerId || null,
    memberIds: data.memberIds || [],
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  ws.teams.push(team);
  await getWorkspaces().update(workspaceId, { teams: ws.teams });
  return { ...team };
}

export async function update(workspaceId, teamId, data) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return null;
  const idx = ws.teams.findIndex((t) => t.id === teamId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  ws.teams[idx] = { ...ws.teams[idx], ...data, updatedAt: now };
  await getWorkspaces().update(workspaceId, { teams: ws.teams });
  return { ...ws.teams[idx] };
}

export async function delete_(workspaceId, teamId) {
  await delay();
  const ws = await getWorkspaces().findById(workspaceId);
  if (!ws) return;
  ws.teams = ws.teams.filter((t) => t.id !== teamId);
  await getWorkspaces().update(workspaceId, { teams: ws.teams });
}

export default { findById, findByWorkspace, create, update, delete_ };
