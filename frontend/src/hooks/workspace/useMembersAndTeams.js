'use client';

import { useCallback } from 'react';
import { generateId } from '@/lib/workspaceData';
import { getWorkspacePlan, getWorkspaceUsageSnapshot, validateWorkspaceCapacity } from '@/services/billingService';

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
  const updateMemberRole = useCallback((workspaceId, userId, newRole) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          members: (ws.members || []).map((m) =>
            m.userId === userId ? { ...m, role: newRole } : m
          ),
        };
      })
    );
    addActivity('member_role_updated', 'Member role updated');
  }, [setWorkspaces, addActivity]);

  const removeMember = useCallback((workspaceId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          members: (ws.members || []).filter((m) => m.userId !== userId),
          teams: (ws.teams || []).map((team) => ({
            ...team,
            memberIds: (team.memberIds || []).filter((id) => id !== userId),
          })),
        };
      })
    );
    addActivity('member_removed', 'Member removed from workspace');
  }, [setWorkspaces, addActivity]);

  // ─── Team CRUD Actions ─────────────────────────────────
  const createTeam = useCallback((workspaceId, teamData) => {
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

    addActivity('team_created', 'Team "' + newTeam.name + '" created');
    completeOnboardingStep('teamCreated');
    showToast('success', 'Team "' + newTeam.name + '" created!');

    return newTeam;
  }, [currentUser, workspaces, workspaceMeetings, addActivity, showToast, completeOnboardingStep]);

  const updateTeam = useCallback((workspaceId, teamId, teamData) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).map((t) =>
            t.id === teamId
              ? { ...t, ...teamData, updatedAt: new Date().toISOString() }
              : t
          ),
        };
      })
    );
    addActivity('team_updated', 'Team updated');
  }, [setWorkspaces, addActivity]);

  const deleteTeam = useCallback((workspaceId, teamId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).filter((t) => t.id !== teamId),
        };
      })
    );
    addActivity('team_deleted', 'Team deleted');
  }, [setWorkspaces, addActivity]);

  const addMemberToTeam = useCallback((workspaceId, teamId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).map((t) => {
            if (t.id !== teamId) return t;
            const members = t.memberIds || [];
            return members.includes(userId) ? t : { ...t, memberIds: [...members, userId] };
          }),
        };
      })
    );
    addActivity('team_member_added', 'Member added to team');
  }, [setWorkspaces, addActivity]);

  const removeMemberFromTeam = useCallback((workspaceId, teamId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).map((t) =>
            t.id === teamId
              ? { ...t, memberIds: (t.memberIds || []).filter((id) => id !== userId) }
              : t
          ),
        };
      })
    );
    addActivity('team_member_removed', 'Member removed from team');
  }, [setWorkspaces, addActivity]);

  const assignTeamManager = useCallback((workspaceId, teamId, managerId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).map((t) => {
            if (t.id !== teamId) return t;
            const members = t.memberIds || [];
            return {
              ...t,
              managerId,
              memberIds: members.includes(managerId) ? members : [...members, managerId],
            };
          }),
        };
      })
    );
    addActivity('team_manager_assigned', 'Team manager assigned');
  }, [setWorkspaces, addActivity]);

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
