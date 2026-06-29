'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { generateId } from '@/lib/workspaceData';
import { getWorkspacePlan, getWorkspaceUsageSnapshot, validateWorkspaceCapacity } from '@/services/billingService';
import { getGlobalSocket } from '@/context/VoiceConnectionContext';

const INVITATIONS_STORAGE_KEY = 'meetingAppInvitations';

/**
 * Load all invitations from localStorage (shared global store).
 * Returns an empty array when no stored data or on parse failure.
 */
function loadStoredInvitations() {
  try {
    const raw = localStorage.getItem(INVITATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persist invitations array to localStorage.
 */
function persistInvitations(invitations) {
  try {
    localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(invitations));
  } catch {
    // Storage is best-effort
  }
}

/**
 * useInvitationsState — manages invitations state and actions.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @param {Array} params.workspaces
 * @param {Array} params.workspaceMeetings
 * @param {Function} params.setWorkspaces
 * @param {Function} params.setWorkspaceMeetings
 * @param {Function} params.setActiveWorkspaceId
 * @param {Function} params.setActiveChannelId
 * @param {Function} params.setActiveTeamId
 * @param {Function} params.setActiveView
 * @param {Function} params.addActivity
 * @param {Function} params.showToast
 * @returns {{
 *   invitations: Array,
 *   setInvitations: Function,
 *   userInvitations: Array,
 *   sendInvitation: (workspaceId: string, inviteeEmail: string, role: string, teamIds?: Array) => Object|null,
 *   acceptInvitation: (invitationId: string) => void,
 *   declineInvitation: (invitationId: string) => void,
 * }}
 */
export default function useInvitationsState({
  currentUser,
  workspaces,
  workspaceMeetings,
  setWorkspaces,
  setWorkspaceMeetings,
  setActiveWorkspaceId,
  setActiveChannelId,
  setActiveTeamId,
  setActiveView,
  addActivity,
  showToast,
}) {
  const [invitations, setInvitations] = useState(() => loadStoredInvitations());

  // ─── Cross-tab sync via storage events ─────────────────
  useEffect(() => {
    const handler = (event) => {
      if (event.key === INVITATIONS_STORAGE_KEY) {
        setInvitations(loadStoredInvitations());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ─── Real-time invitation relay via signaling server ────
  // VoiceConnectionProvider relays socket events as window CustomEvents,
  // so any module can respond without a direct socket dependency.
  useEffect(() => {
    const handleNew = (event) => {
      const invitation = event.detail;
      if (!invitation || !invitation.id) return;
      setInvitations((prev) => {
        // Avoid duplicates (same ID already exists)
        if (prev.some((i) => i.id === invitation.id)) return prev;
        return [...prev, invitation];
      });
    };
    const handleAccepted = (event) => {
      const { invitation, acceptedBy } = event.detail || {};
      if (!invitation?.id || !acceptedBy) return;
      // Mark invitation as accepted so sender's UI reflects the change
      setInvitations((prev) =>
        prev.map((i) =>
          i.id === invitation.id ? { ...i, status: 'ACCEPTED' } : i
        )
      );
    };
    window.addEventListener('invitation:new', handleNew);
    window.addEventListener('invitation:accepted', handleAccepted);
    return () => {
      window.removeEventListener('invitation:new', handleNew);
      window.removeEventListener('invitation:accepted', handleAccepted);
    };
  }, []);

  // ─── Persist whenever invitations change ───────────────
  useEffect(() => {
    persistInvitations(invitations);
  }, [invitations]);

  /**
   * Invitations addressed to the current user (by email).
   * In mock mode, all users share localStorage on the same machine,
   * so the inviteeEmail field acts as the routing key.
   */
  const userInvitations = useMemo(() => {
    if (!currentUser?.email) return [];
    return invitations.filter(
      (inv) => inv.inviteeEmail === currentUser.email && inv.status === 'PENDING'
    );
  }, [invitations, currentUser]);

  // ─── Invitation Actions ────────────────────────────────
  const sendInvitation = useCallback((workspaceId, inviteeEmail, role, teamIds = []) => {
    if (!currentUser) return;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const plan = getWorkspacePlan(workspace);
    const usage = getWorkspaceUsageSnapshot({
      workspace,
      meetings: workspaceMeetings,
      members: workspace.members || [],
    });
    const capacity = validateWorkspaceCapacity({
      plan,
      usage: { ...usage, memberCount: usage.memberCount + 1 },
    });
    if (!capacity.allowed) {
      showToast('error', capacity.message);
      return null;
    }
    if (capacity.warning) {
      showToast('info', capacity.message);
    }

    const newInv = {
      id: 'inv-' + generateId(),
      workspaceId,
      workspaceName: workspace.name,
      invitedByUserId: currentUser.id,
      invitedByUserName: currentUser.name,
      inviteeEmail,
      role: role || 'EMPLOYEE',
      teamIds: Array.from(new Set(teamIds || [])),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    setInvitations((prev) => [...prev, newInv]);
    addActivity('invitation_sent', 'Invitation sent to ' + inviteeEmail);
    showToast('success', teamIds?.length ? 'Invitation sent and assigned to selected teams.' : 'Invitation sent to ' + inviteeEmail);

    // Relay invitation via signaling server if connected (real-time cross-user)
    const sock = getGlobalSocket();
    if (sock?.connected) {
      sock.emit('invitation:send', {
        inviteeEmail,
        invitation: newInv,
      });
    }

    return newInv;
  }, [currentUser, workspaces, workspaceMeetings, addActivity, showToast]);

  const acceptInvitation = useCallback((invitationId) => {
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) return;

    setInvitations((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: 'ACCEPTED' } : i))
    );

    // Notify the original sender in real time via signaling server
    const sock = getGlobalSocket();
    if (sock?.connected && currentUser?.id) {
      sock.emit('invitation:accept', {
        fromUserId: currentUser.id,
        invitation: inv,
      });
    }

    // Add user as workspace member
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== inv.workspaceId) return ws;
        const alreadyMember = ws.members.some((m) => m.userId === currentUser?.id);
        if (alreadyMember) return ws;
        return {
          ...ws,
          members: [
            ...ws.members,
            {
              userId: currentUser?.id,
              role: inv.role || 'EMPLOYEE',
              joinedAt: new Date().toISOString(),
            },
          ],
        };
      })
    );

    // Assign user to teams
    if (inv.teamIds && inv.teamIds.length > 0) {
      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (ws.id !== inv.workspaceId) return ws;
          return {
            ...ws,
            teams: (ws.teams || []).map((team) => ({
              ...team,
              memberIds: inv.teamIds.includes(team.id)
                ? [...new Set([...(team.memberIds || []), currentUser?.id])]
                : team.memberIds || [],
            })),
          };
        })
      );
    }

    // Switch to the workspace
    setActiveWorkspaceId(inv.workspaceId);
    const targetWs = workspaces.find((w) => w.id === inv.workspaceId);
    if (targetWs) {
      const general = targetWs.channels.find((c) => c.isDefault && c.type === 'text');
      setActiveChannelId(general?.id || null);
    }
    setActiveTeamId(null);
    setActiveView('home');

    addActivity('invitation_accepted', 'Joined workspace ' + (inv.workspaceName || ''));
    showToast('success', 'You have joined "' + (inv.workspaceName || 'Workspace') + '"!');
  }, [invitations, currentUser, workspaces, setWorkspaces, setActiveWorkspaceId, setActiveChannelId, setActiveTeamId, setActiveView, addActivity, showToast]);

  const declineInvitation = useCallback((invitationId) => {
    setInvitations((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: 'DECLINED' } : i))
    );
  }, []);

  return {
    invitations,
    setInvitations,
    userInvitations,
    sendInvitation,
    acceptInvitation,
    declineInvitation,
  };
}
