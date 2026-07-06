'use client';

import { useCallback } from 'react';
import { generateId } from '@/lib/workspaceData';
import { getWorkspacePlan, getWorkspaceUsageSnapshot, validateWorkspaceCapacity } from '@/services/billingService';
import { workspacesApi } from '@/services/cloudClient';

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
      addActivity('member_role_updated', 'Member role updated');
    } catch {
      showToast('error', 'Failed to update member role.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  const removeMember = useCallback(async (workspaceId, userId) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const members = (workspace.members || []).filter((m) => m.userId !== userId);
    const teams = (workspace.teams || []).map((team) => ({
      ...team,
      memberIds: (team.memberIds || []).filter((id) => id !== userId),
    }));
    try {
      const saved = await workspacesApi.update(workspaceId, {
        members,
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
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
      managerId: teamData.managerId || currentUser.id,
      memberIds: [currentUser.id, ...(teamData.memberIds || [])],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams: [...(workspace.teams || []), newTeam],
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
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
    const teams = (workspace.teams || []).map((t) =>
      t.id === teamId ? { ...t, ...teamData, updatedAt: new Date().toISOString() } : t
    );
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
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
      const members = t.memberIds || [];
      return members.includes(userId) ? t : { ...t, memberIds: [...members, userId] };
    });
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      addActivity('team_member_added', 'Member added to team');
    } catch {
      showToast('error', 'Failed to add member to team.');
    }
  }, [workspaces, setWorkspaces, addActivity, showToast]);

  const removeMemberFromTeam = useCallback(async (workspaceId, teamId, userId) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const teams = (workspace.teams || []).map((t) =>
      t.id === teamId ? { ...t, memberIds: (t.memberIds || []).filter((id) => id !== userId) } : t
    );
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
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
      const members = t.memberIds || [];
      return {
        ...t,
        managerId,
        memberIds: members.includes(managerId) ? members : [...members, managerId],
      };
    });
    try {
      const saved = await workspacesApi.update(workspaceId, {
        teams,
        expectedVersion: workspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
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
