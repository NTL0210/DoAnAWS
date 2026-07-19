'use client';

import { useCallback } from 'react';
import { generateId } from '@/lib/workspaceData';
import { getWorkspacePlan, getWorkspaceUsageSnapshot, validateWorkspaceCapacity } from '@/services/billingService';
import { workspacesApi } from '@/services/cloudClient';
import { getGlobalSocket } from '@/context/VoiceConnectionContext';

/**
 * useMembersAndTeams — manages member and team CRUD actions.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @param {Array} params.workspaces
 * @param {Array} params.workspaceMeetings
 * @param {Function} params.setWorkspaces
 * @param {Function} params.setWorkspaceMeetings
 * @param {Function} params.addActivity
 * @param {Function} params.showToast
 * @param {Function} params.completeOnboardingStep
 * @returns {{
 *   updateMemberRole: (workspaceId: string, userId: string, newRole: string) => void,
 *   removeMember: (workspaceId: string, userId: string) => void,
 *   createTeam: (workspaceId: string, teamData: Object) => Object|null,
 *   updateTeam: (workspaceId: string, teamId: string, teamData: Object) => void,
 *   deleteTeam: (workspaceId: string, teamId: string) => void,
 *   addMemberToTeam: (workspaceId: string, teamId: string, userId: string) => void,
 *   removeMemberFromTeam: (workspaceId: string, teamId: string, userId: string) => void,
 *   assignTeamManager: (workspaceId: string, teamId: string, managerId: string) => void,
 * }}
 */
export default function useMembersAndTeams({
  currentUser,
  workspaces,
  workspaceMeetings,
  setWorkspaces,
  setWorkspaceMeetings,
  addActivity,
  showToast,
  completeOnboardingStep,
}) {
  // ─── Member Actions ────────────────────────────────────
  const updateMemberRole = useCallback(async (workspaceId, userId, newRole) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const members = (workspace.members || []).map((m) =>
      m.userId === userId ? { ...m, role: newRole } : m
    );
    try {
      const saved = await workspacesApi.update(workspaceId, {
        members,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'MEMBER_ROLE_UPDATED');
      addActivity('member_role_updated', 'Member role updated');
    } catch {
      showToast('error', 'Failed to update member role.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  const removeMember = useCallback(async (workspaceId, userId) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const remainingMembers = (workspace.members || []).filter((member) => member.userId !== userId);
    const teams = (workspace.teams || []).map((team) => ({
      ...team,
      memberIds: normalizeTeamMemberIds(
        (team.memberIds || []).filter((id) => id !== userId),
        remainingMembers,
      ),
    }));
    try {
      const saved = await workspacesApi.update(workspaceId, {
        members: remainingMembers,
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'MEMBER_REMOVED');
      addActivity('member_removed', 'Member removed from workspace');
    } catch {
      showToast('error', 'Failed to remove member.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  // ─── Team CRUD Actions ─────────────────────────────────
  const createTeam = useCallback(async (workspaceId, teamData) => {
    if (!currentUser) return null;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return null;

    const plan = getWorkspacePlan(workspace);
    const usage = getWorkspaceUsageSnapshot({
      workspace,
      meetings: workspaceMeetings,
      members: workspace.members || [],
    });
    const capacity = validateWorkspaceCapacity({
      plan,
      usage: { ...usage, teamCount: (usage.teamCount || 0) + 1 },
    });
    if (!capacity.allowed) {
      showToast('error', capacity.message);
      return null;
    }
    if (capacity.warning) {
      showToast('info', capacity.message);
    }

    const teamId = 'team-' + generateId();
    const newTeam = {
      id: teamId,
      name: teamData.name || 'New Team',
      description: teamData.description || '',
      color: teamData.color || '#5865F2',
      managerId: teamData.managerId || currentUser.id,
      memberIds: normalizeTeamMemberIds([
        currentUser.id,
        ...(teamData.memberIds || []),
        teamData.managerId,
      ], workspace.members || []),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams: [...(workspace.teams || []), newTeam],
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'TEAM_CREATED');
      addActivity('team_created', 'Team "' + newTeam.name + '" created');
      completeOnboardingStep('teamCreated');
      showToast('success', 'Team "' + newTeam.name + '" created!');
      return newTeam;
    } catch {
      showToast('error', 'Failed to create team.');
      return null;
    }
  }, [currentUser, workspaces, workspaceMeetings, setWorkspaces, addActivity, showToast, completeOnboardingStep]);

  const updateTeam = useCallback(async (workspaceId, teamId, teamData) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const teams = (workspace.teams || []).map((t) => {
      const team = t.id === teamId ? { ...t, ...teamData, updatedAt: new Date().toISOString() } : t;
      return {
        ...team,
        memberIds: normalizeTeamMemberIds(team.memberIds || [], workspace.members || []),
      };
    });
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'TEAM_UPDATED');
      addActivity('team_updated', 'Team updated');
    } catch {
      showToast('error', 'Failed to update team.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  const deleteTeam = useCallback(async (workspaceId, teamId) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const teams = (workspace.teams || []).filter((t) => t.id !== teamId);
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'TEAM_DELETED');
      addActivity('team_deleted', 'Team deleted');
    } catch {
      showToast('error', 'Failed to delete team.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  const addMemberToTeam = useCallback(async (workspaceId, teamId, userId) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const teams = (workspace.teams || []).map((t) => {
      if (t.id !== teamId) return t;
      return {
        ...t,
        memberIds: normalizeTeamMemberIds([...(t.memberIds || []), userId], workspace.members || []),
      };
    });
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'TEAM_MEMBER_ADDED');
      addActivity('team_member_added', 'Member added to team');
    } catch {
      showToast('error', 'Failed to add member to team.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  const removeMemberFromTeam = useCallback(async (workspaceId, teamId, userId) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const teams = (workspace.teams || []).map((t) =>
      t.id === teamId
        ? {
            ...t,
            memberIds: normalizeTeamMemberIds(
              (t.memberIds || []).filter((id) => id !== userId),
              workspace.members || [],
            ),
          }
        : t
    );
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'TEAM_MEMBER_REMOVED');
      addActivity('team_member_removed', 'Member removed from team');
    } catch {
      showToast('error', 'Failed to remove member from team.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  const assignTeamManager = useCallback(async (workspaceId, teamId, managerId) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const teams = (workspace.teams || []).map((t) => {
      if (t.id !== teamId) return t;
      return {
        ...t,
        managerId,
        memberIds: normalizeTeamMemberIds([...(t.memberIds || []), managerId], workspace.members || []),
      };
    });
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      publishWorkspaceChange(workspaceId, 'TEAM_MANAGER_ASSIGNED');
      addActivity('team_manager_assigned', 'Team manager assigned');
    } catch {
      showToast('error', 'Failed to assign team manager.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  return {
    updateMemberRole,
    removeMember,
    createTeam,
    updateTeam,
    deleteTeam,
    addMemberToTeam,
    removeMemberFromTeam,
    assignTeamManager,
  };
}

function normalizeTeamMemberIds(memberIds, workspaceMembers) {
  const validMemberIds = new Set((workspaceMembers || []).map((member) => member.userId));
  return Array.from(new Set((memberIds || []).filter(Boolean)))
    .filter((userId) => validMemberIds.size === 0 || validMemberIds.has(userId));
}

function publishWorkspaceChange(workspaceId, reason) {
  getGlobalSocket()?.emit('workspace:event', {
    workspaceId,
    type: 'WORKSPACE_STRUCTURE_CHANGED',
    payload: { reason },
  });
}
