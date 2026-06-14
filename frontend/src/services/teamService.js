/**
 * TeamService — business logic for teams
 */

import { teamRepo } from '@/repositories';
import { generateId } from '@/services/workspaceService';

/**
 * Get teams for a workspace
 * @param {string} workspaceId
 * @returns {Promise<Object[]>}
 */
export async function getTeamsByWorkspace(workspaceId) {
  return teamRepo.findByWorkspace(workspaceId);
}

/**
 * Get team by ID
 * @param {string} workspaceId
 * @param {string} teamId
 * @returns {Promise<Object|null>}
 */
export async function getTeamById(workspaceId, teamId) {
  return teamRepo.findById(workspaceId, teamId);
}

/**
 * Create a new team
 * @param {string} workspaceId
 * @param {Object} data
 * @param {string} data.name
 * @param {string} [data.description]
 * @param {string} [data.color]
 * @param {string} [data.managerId]
 * @param {string[]} [data.memberIds]
 * @param {string} [currentUserId]
 * @returns {Promise<Object|null>}
 */
export async function createTeam(workspaceId, data, currentUserId) {
  if (!data.name?.trim()) return null;

  const memberIds = Array.from(new Set([
    ...(data.memberIds || []),
    currentUserId,
    data.managerId,
  ].filter(Boolean)));

  return teamRepo.create(workspaceId, {
    id: workspaceId + '-team-' + generateId(),
    workspaceId,
    name: data.name.trim(),
    description: data.description || '',
    color: data.color || '#5865F2',
    managerId: data.managerId || currentUserId || null,
    memberIds,
  });
}

/**
 * Update a team
 * @param {string} workspaceId
 * @param {string} teamId
 * @param {Object} data
 * @returns {Promise<Object|null>}
 */
export async function updateTeam(workspaceId, teamId, data) {
  return teamRepo.update(workspaceId, teamId, data);
}

/**
 * Delete a team
 * @param {string} workspaceId
 * @param {string} teamId
 * @returns {Promise<void>}
 */
export async function deleteTeam(workspaceId, teamId) {
  return teamRepo.delete_(workspaceId, teamId);
}

/**
 * Add a member to a team
 * @param {string} workspaceId
 * @param {string} teamId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function addMemberToTeam(workspaceId, teamId, userId) {
  const team = await teamRepo.findById(workspaceId, teamId);
  if (!team || team.memberIds.includes(userId)) return team;
  return teamRepo.update(workspaceId, teamId, {
    memberIds: [...team.memberIds, userId],
  });
}

/**
 * Remove a member from a team
 * @param {string} workspaceId
 * @param {string} teamId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function removeMemberFromTeam(workspaceId, teamId, userId) {
  const team = await teamRepo.findById(workspaceId, teamId);
  if (!team) return null;
  return teamRepo.update(workspaceId, teamId, {
    memberIds: team.memberIds.filter((id) => id !== userId),
  });
}

/**
 * Assign a manager to a team
 * @param {string} workspaceId
 * @param {string} teamId
 * @param {string} managerId
 * @returns {Promise<Object|null>}
 */
export async function assignTeamManager(workspaceId, teamId, managerId) {
  const team = await teamRepo.findById(workspaceId, teamId);
  if (!team) return null;
  return teamRepo.update(workspaceId, teamId, {
    managerId,
    memberIds: Array.from(new Set([...(team.memberIds || []), managerId].filter(Boolean))),
  });
}
