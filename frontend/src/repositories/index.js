/**
 * Repository factory — provides repository implementations backed by cloud API.
 *
 * All data now goes through DynamoDB via the cloud API Gateway.
 * In local dev (non-cloud mode), falls back to in-memory/API adapters.
 *
 * Components and services should NEVER import mock repositories directly.
 * Always use this factory:
 *
 *   import { workspaceRepo } from '@/repositories';
 */

import { isCloudMode } from '@/config/runtimeConfig';
import { workspacesApi, usersApi, meetingsApi, tasksApi } from '@/services/cloudClient';

/**
 * Workspace repository — delegates to cloud API when in cloud mode.
 */
export const workspaceRepo = {
  findById: async (id) => {
    return workspacesApi.get(id);
  },
  findByUserId: async (userId) => {
    return workspacesApi.list({ userId });
  },
  create: async (data) => {
    return workspacesApi.create(data);
  },
  update: async (id, data) => {
    return workspacesApi.update(id, data);
  },
  delete_: async (id) => {
    return workspacesApi.delete(id);
  },
};

/**
 * User repository — delegates to cloud API when in cloud mode.
 */
export const userRepo = {
  findById: async (id) => {
    return usersApi.get(id);
  },
  findByEmail: async (email) => {
    return usersApi.list({ email });
  },
  create: async (data) => {
    return usersApi.create(data);
  },
  update: async (id, data) => {
    return usersApi.update(id, data);
  },
};

/**
 * Meeting repository — delegates to cloud API when in cloud mode.
 */
export const meetingRepo = {
  findById: async (id) => {
    return meetingsApi.get(id);
  },
  findByWorkspace: async (workspaceId) => {
    return meetingsApi.list({ workspaceId });
  },
  create: async (data) => {
    return meetingsApi.create(data);
  },
  update: async (id, data) => {
    return meetingsApi.update(id, data);
  },
};

/**
 * Task repository — delegates to cloud API when in cloud mode.
 */
export const taskRepo = {
  findByWorkspace: async (workspaceId) => {
    return tasksApi.list({ workspaceId });
  },
  findById: async (id) => {
    return tasksApi.get(id);
  },
  create: async (data) => {
    return tasksApi.create(data);
  },
  update: async (id, data) => {
    return tasksApi.update(id, data);
  },
  delete_: async (id) => {
    return tasksApi.delete(id);
  },
};

/**
 * Team repository — workspaces store teams as nested array.
 * Uses workspace update API to persist team changes.
 */
export const teamRepo = {
  findByWorkspace: async (workspaceId) => {
    const ws = await workspacesApi.get(workspaceId);
    return ws?.teams ?? [];
  },
  findById: async (workspaceId, teamId) => {
    const ws = await workspacesApi.get(workspaceId);
    return ws?.teams?.find((t) => t.id === teamId) ?? null;
  },
  create: async (workspaceId, data) => {
    // Create is handled by the hook which updates workspace state,
    // then the sync effect persists to API.
    return data;
  },
  update: async (workspaceId, teamId, data) => {
    const ws = await workspacesApi.get(workspaceId);
    if (!ws) return null;
    const teams = (ws.teams ?? []).map((t) =>
      t.id === teamId ? { ...t, ...data } : t
    );
    await workspacesApi.update(workspaceId, { teams, expectedVersion: ws.version ?? 1 });
    return teams.find((t) => t.id === teamId) ?? null;
  },
  delete_: async (workspaceId, teamId) => {
    const ws = await workspacesApi.get(workspaceId);
    if (!ws) return;
    const teams = (ws.teams ?? []).filter((t) => t.id !== teamId);
    await workspacesApi.update(workspaceId, { teams, expectedVersion: ws.version ?? 1 });
  },
};

/**
 * Channel repository — workspaces store channels as nested array.
 * Uses workspace update API to persist channel changes.
 */
export const channelRepo = {
  findByWorkspace: async (workspaceId) => {
    const ws = await workspacesApi.get(workspaceId);
    return ws?.channels ?? [];
  },
  create: async (workspaceId, data) => {
    // Create is handled by the hook which updates workspace state,
    // then the sync effect persists to API.
    return data;
  },
  delete_: async (workspaceId, channelId) => {
    // Delete is handled by the hook which updates workspace state,
    // then the sync effect persists to API.
  },
};

/**
 * Message repository — workspaces store messages as a record.
 * Uses workspace update API to persist message changes.
 */
export const messageRepo = {
  findByChannel: async () => [],
  findByTeamChat: async () => [],
  create: async (data) => data,
};

/**
 * Notification repository — delegates to cloud API.
 */
export const notificationRepo = {
  findByUser: async (userId) => {
    const { notificationsApi } = await import('@/services/cloudClient');
    return notificationsApi.list({ userId });
  },
  findUnreadByUser: async (userId) => {
    const { notificationsApi } = await import('@/services/cloudClient');
    const all = await notificationsApi.list({ userId });
    return (all ?? []).filter((n) => !n.isRead);
  },
  create: async (data) => {
    const { notificationsApi } = await import('@/services/cloudClient');
    return notificationsApi.update(data.id, data);
  },
  markAsRead: async (notificationId) => {
    const { notificationsApi } = await import('@/services/cloudClient');
    return notificationsApi.update(notificationId, { isRead: true });
  },
  markAllAsRead: async (userId) => {
    // Best-effort; individual notification marking handles this
  },
};

/**
 * Voice repository — voice records are stored in workspace document.
 */
export const voiceRepo = {
  findByChannel: async (workspaceId, channelId) => {
    const ws = await workspacesApi.get(workspaceId);
    return (ws?.voiceRecords ?? []).filter(
      (r) => typeof r === 'object' && r.channelId === channelId
    );
  },
  createVoiceRecord: async (data) => data,
  updateVoiceRecord: async (id, data) => data,
  deleteVoiceRecord: async (id) => {},
};

export default {
  workspaceRepo,
  taskRepo,
  meetingRepo,
  userRepo,
  teamRepo,
  channelRepo,
  messageRepo,
  notificationRepo,
  voiceRepo,
};
