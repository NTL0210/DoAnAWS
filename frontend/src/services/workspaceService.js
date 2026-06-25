/**
 * WorkspaceService — business logic for workspaces
 *
 * Extends the existing src/services/workspaceService.js
 */

export { canManageAIWorkflow } from './permissionService';
export { getDefaultPermissionsForRole } from '@/data/defaults/roles';

/**
 * Get a team from a workspace by team ID
 * @param {Object} workspace
 * @param {string} teamId
 * @returns {Object|null}
 */
export function getWorkspaceTeam(workspace, teamId) {
  if (!workspace || !teamId) return null;
  return workspace.teams?.find((team) => team.id === teamId) || null;
}

/**
 * Get team members from workspace members
 * @param {Array} workspaceMembers
 * @param {Object} team
 * @returns {Array}
 */
export function getTeamMembers(workspaceMembers, team) {
  if (!team) return workspaceMembers || [];
  return (workspaceMembers || []).filter((member) => team.memberIds?.includes(member.userId));
}

import { workspaceRepo, teamRepo, channelRepo } from '@/repositories';
import { DEFAULT_FEATURES } from '@/data/defaults/features';
import { DEFAULT_TEXT_CHANNELS, DEFAULT_VOICE_CHANNELS } from '@/data/defaults/channels';
import { DEFAULT_TEAMS } from '@/data/defaults/teams';

/**
 * Generate a URL-friendly slug from a workspace name
 * @param {string} name
 * @returns {string}
 */
export function generateWorkspaceSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace';
}

/**
 * Generate a unique ID
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Create a complete default workspace structure
 * @param {string} name
 * @param {string} ownerId
 * @returns {Object}
 */
export function createDefaultWorkspaceStructure(name, ownerId) {
  const wsId = 'ws-' + generateId();
  const slug = generateWorkspaceSlug(name);
  const now = new Date().toISOString();

  const textChannels = DEFAULT_TEXT_CHANNELS.map((ch, i) => ({
    id: wsId + '-ch-' + i,
    name: ch.name,
    type: 'text',
    description: ch.description,
    isDefault: ch.isDefault,
  }));

  const voiceChannels = DEFAULT_VOICE_CHANNELS.map((ch, i) => ({
    id: wsId + '-vc-' + i,
    name: ch.name,
    type: 'voice',
    scope: ch.scope,
    teamId: ch.teamId,
    allowedTeamIds: ch.allowedTeamIds,
    allowedUserIds: ch.allowedUserIds,
    deniedUserIds: ch.deniedUserIds,
    isDefault: ch.isDefault,
    isLocked: ch.isLocked,
    allowRecording: ch.allowRecording,
    createdAt: now,
    updatedAt: now,
  }));

  const teams = DEFAULT_TEAMS.map((team, i) => ({
    id: wsId + '-team-' + i,
    name: team.name,
    description: team.description,
    color: team.color,
    managerId: ownerId,
    memberIds: [ownerId],
    createdAt: now,
    updatedAt: now,
  }));

  return {
    id: wsId,
    name: name.trim(),
    slug,
    ownerId,
    channels: [...textChannels, ...voiceChannels],
    teams,
    members: [
      {
        userId: ownerId,
        role: 'OWNER',
        joinedAt: now,
        nickname: null,
      },
    ],
    customRoles: [],
    features: DEFAULT_FEATURES.map((f) => ({ ...f })),
    createdAt: now,
    updatedAt: now,
  };
}

export function createCleanWorkspaceStructure(workspaceData, ownerId, options = {}) {
  const name = typeof workspaceData === 'string' ? workspaceData : workspaceData?.name;
  const wsId = 'ws-' + generateId();
  const now = new Date().toISOString();
  const channels = [];

  if (options.createDefaultTextChannel !== false) {
    channels.push({
      id: `${wsId}-ch-general`,
      workspaceId: wsId,
      name: 'general',
      type: 'text',
      description: 'General discussion',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (options.createDefaultVoiceChannel !== false) {
    channels.push({
      id: `${wsId}-vc-general`,
      workspaceId: wsId,
      name: 'General Voice',
      type: 'voice',
      scope: 'WORKSPACE',
      teamId: null,
      allowedTeamIds: [],
      allowedUserIds: [],
      deniedUserIds: [],
      isDefault: channels.length === 0,
      isLocked: false,
      allowRecording: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    id: wsId,
    name: name.trim(),
    description: workspaceData?.description || '',
    iconColor: workspaceData?.iconColor || 'blue',
    workspaceType: workspaceData?.workspaceType || 'blank',
    visibility: workspaceData?.visibility || 'private',
    billingPlanId: workspaceData?.billingPlanId || 'free',
    slug: generateWorkspaceSlug(name),
    ownerId,
    memberIds: [ownerId],
    members: [
      {
        userId: ownerId,
        role: 'OWNER',
        joinedAt: now,
        nickname: null,
      },
    ],
    teams: [],
    channels,
    tasks: [],
    meetings: [],
    messages: {},
    notifications: [],
    invitations: [],
    voiceRecords: [],
    customRoles: [],
    features: DEFAULT_FEATURES.map((f) => ({ ...f })),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create initial activity for a new workspace
 * @param {string} workspaceId
 * @param {string} userName
 * @returns {Array}
 */
export function createInitialActivity(workspaceId, userName) {
  const now = new Date().toISOString();
  return [
    {
      id: 'act-' + generateId(),
      type: 'workspace_created',
      message: `${userName} created this workspace`,
      userId: null,
      timestamp: now,
    },
  ];
}

/**
 * Find all workspaces for a user
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function getWorkspacesForUser(userId) {
  return workspaceRepo.findByUserId(userId);
}

/**
 * Find workspace by ID
 * @param {string} workspaceId
 * @returns {Promise<Object|null>}
 */
export async function getWorkspaceById(workspaceId) {
  return workspaceRepo.findById(workspaceId);
}

/**
 * Create a new workspace and persist
 * @param {Object} param0
 * @param {string} param0.name
 * @param {string} param0.ownerId
 * @returns {Promise<Object>}
 */
export async function createWorkspace({
  name,
  ownerId,
  description,
  workspaceType,
  visibility,
  iconColor,
  createDefaultTextChannel = true,
  createDefaultVoiceChannel = true,
}) {
  const structure = createCleanWorkspaceStructure(
    { name, description, workspaceType, visibility, iconColor },
    ownerId,
    { createDefaultTextChannel, createDefaultVoiceChannel }
  );
  return workspaceRepo.create(structure);
}
