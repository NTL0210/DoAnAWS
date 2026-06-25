'use client';

import { useCallback } from 'react';
import {
  generateId,
  getWorkspaceRole,
  hasWorkspacePermission,
  getUserWorkspacePermissions,
} from '@/lib/workspaceData';
import { canAccessVoiceChannel, canRecordVoiceChannel } from '@/lib/voicePermissions';

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
}) {
  const createCustomRole = useCallback((workspaceId, roleData) => {
    const roleId = 'cr-' + generateId();
    const newRole = {
      id: roleId,
      name: roleData.name,
      permissions: roleData.permissions || [],
      createdAt: new Date().toISOString(),
    };
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        const existing = ws.customRoles || [];
        return { ...ws, customRoles: [...existing, newRole] };
      })
    );
    return newRole;
  }, [setWorkspaces]);

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
    can,
    canInWorkspace,
    canAccessVoice,
    canRecordVoice,
    getMemberProfile,
    getAllPermissions,
  };
}
