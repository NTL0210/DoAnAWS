'use client';

import { useCallback } from 'react';
import {
  generateId,
  getWorkspaceRole,
  hasWorkspacePermission,
  getUserWorkspacePermissions,
} from '@/lib/workspaceData';
import { canAccessVoiceChannel, canRecordVoiceChannel } from '@/lib/voicePermissions';
import { workspacesApi } from '@/services/cloudClient';
import { getGlobalSocket } from '@/context/VoiceConnectionContext';

/**
 * useRolesAndPermissions — manages workspace roles and permission checks.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @param {Array} params.workspaces
 * @param {Object|null} params.activeWorkspace
 * @param {string|null} params.workspaceRole
 * @param {Array} params.workspaceTeams
 * @param {Array} params.workspaceMembers
 * @param {Function} params.setWorkspaces
 * @returns {{
 *   createCustomRole: (workspaceId: string, roleData: Object) => Object,
 *   can: (permission: string) => boolean,
 *   canInWorkspace: (workspaceId: string, permission: string) => boolean,
 *   canAccessVoice: (channel: Object) => boolean,
 *   canRecordVoice: (channel: Object) => boolean,
 *   getMemberProfile: (userId: string) => Object|null,
 *   getAllPermissions: () => Array|string,
 * }}
 */
export default function useRolesAndPermissions({
  currentUser,
  workspaces,
  activeWorkspace,
  workspaceRole,
  workspaceTeams,
  workspaceMembers,
  setWorkspaces,
  showToast,
}) {
  const persistCustomRoles = useCallback(async (workspace, customRoles, reason) => {
    try {
      const saved = await workspacesApi.update(workspace.id, {
        customRoles,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      getGlobalSocket()?.emit('workspace:event', {
        workspaceId: workspace.id,
        type: 'WORKSPACE_STRUCTURE_CHANGED',
        payload: { reason },
      });
      return saved;
    } catch (error) {
      showToast?.('error', error?.message || 'Failed to save workspace roles.');
      return null;
    }
  }, [setWorkspaces, showToast]);

  const createCustomRole = useCallback(async (workspaceId, roleData) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return null;
    const roleId = 'cr-' + generateId();
    const now = new Date().toISOString();
    const newRole = {
      id: roleId,
      name: roleData.name.trim(),
      description: roleData.description?.trim() || '',
      color: roleData.color || '#5865F2',
      permissions: Array.from(new Set(roleData.permissions || [])),
      createdAt: now,
      updatedAt: now,
    };
    const saved = await persistCustomRoles(
      workspace,
      [...(workspace.customRoles || []), newRole],
      'CUSTOM_ROLE_CREATED',
    );
    if (!saved) return null;
    showToast?.('success', `Role "${newRole.name}" created.`);
    return newRole;
  }, [persistCustomRoles, showToast, workspaces]);

  const updateCustomRole = useCallback(async (workspaceId, roleId, roleData) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return null;
    const customRoles = (workspace.customRoles || []).map((role) => (
      role.id === roleId
        ? {
            ...role,
            ...roleData,
            name: roleData.name?.trim() || role.name,
            description: roleData.description?.trim() ?? role.description ?? '',
            permissions: Array.from(new Set(roleData.permissions || role.permissions || [])),
            updatedAt: new Date().toISOString(),
          }
        : role
    ));
    const saved = await persistCustomRoles(workspace, customRoles, 'CUSTOM_ROLE_UPDATED');
    if (saved) showToast?.('success', 'Role updated.');
    return saved?.customRoles?.find((role) => role.id === roleId) || null;
  }, [persistCustomRoles, showToast, workspaces]);

  const deleteCustomRole = useCallback(async (workspaceId, roleId) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return false;
    if ((workspace.members || []).some((member) => member.role === roleId)) {
      showToast?.('error', 'Move all members to another role before deleting this role.');
      return false;
    }
    const customRoles = (workspace.customRoles || []).filter((role) => role.id !== roleId);
    const saved = await persistCustomRoles(workspace, customRoles, 'CUSTOM_ROLE_DELETED');
    if (saved) showToast?.('success', 'Role deleted.');
    return Boolean(saved);
  }, [persistCustomRoles, showToast, workspaces]);

  const can = useCallback((permission) => {
    if (!activeWorkspace || !currentUser) return false;
    if (workspaceRole === 'OWNER') return true;
    return hasWorkspacePermission(activeWorkspace, currentUser.id, permission);
  }, [activeWorkspace, currentUser, workspaceRole]);

  const canInWorkspace = useCallback((workspaceId, permission) => {
    if (!currentUser) return false;
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (!ws) return false;
    const role = getWorkspaceRole(ws, currentUser.id);
    if (role === 'OWNER') return true;
    return hasWorkspacePermission(ws, currentUser.id, permission);
  }, [currentUser, workspaces]);

  const canAccessVoice = useCallback((channel) => {
    return canAccessVoiceChannel(channel, currentUser, activeWorkspace, workspaceTeams);
  }, [currentUser, activeWorkspace, workspaceTeams]);

  const canRecordVoice = useCallback((channel) => {
    return canRecordVoiceChannel(channel, currentUser, activeWorkspace, workspaceTeams);
  }, [currentUser, activeWorkspace, workspaceTeams]);

  const getMemberProfile = useCallback((userId) => {
    return workspaceMembers.find((m) => m.userId === userId) || null;
  }, [workspaceMembers]);

  const getAllPermissions = useCallback(() => {
    if (!activeWorkspace || !currentUser) return [];
    if (workspaceRole === 'OWNER') return 'all';
    return getUserWorkspacePermissions(activeWorkspace, currentUser.id);
  }, [activeWorkspace, currentUser, workspaceRole]);

  return {
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
    can,
    canInWorkspace,
    canAccessVoice,
    canRecordVoice,
    getMemberProfile,
    getAllPermissions,
  };
}
