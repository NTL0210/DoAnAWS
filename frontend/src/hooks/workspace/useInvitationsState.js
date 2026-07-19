'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { isCloudMode } from '@/services/apiClient';
import { getWorkspacePlan, getWorkspaceUsageSnapshot, validateWorkspaceCapacity } from '@/services/billingService';
import { getGlobalSocket } from '@/context/VoiceConnectionContext';

function notificationToInvitation(notif, currentUser) {
  return {
    id: notif.id,
    workspaceId: notif.metadata?.workspaceId || '',
    workspaceName: notif.metadata?.workspaceName || '',
    invitedByUserId: notif.metadata?.invitedBy || '',
    invitedByUserName: notif.metadata?.invitedByUserName || 'Unknown',
    inviteeEmail: normalizeEmail(notif.metadata?.invitedEmail || currentUser?.email || ''),
    role: notif.metadata?.role || 'EMPLOYEE',
    teamIds: Array.isArray(notif.metadata?.teamIds) ? notif.metadata.teamIds : [],
    status: notif.metadata?.status || notif.status || 'PENDING',
    createdAt: notif.createdAt || new Date().toISOString(),
    backendNotification: notif,
  };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export default function useInvitationsState({
  currentUser,
  workspaces,
  workspaceMeetings,
  setWorkspaces,
  setActiveWorkspaceId,
  setActiveChannelId,
  setActiveTeamId,
  setActiveView,
  addActivity,
  showToast,
}) {
  const [invitations, setInvitations] = useState([]);

  useEffect(() => {
    const handleNew = (event) => {
      const invitation = event.detail;
      if (!invitation || !invitation.id) return;
      setInvitations((prev) => {
        if (prev.some((i) => i.id === invitation.id)) return prev;
        return [...prev, invitation];
      });
    };
    const handleAccepted = (event) => {
      const { invitation, acceptedBy } = event.detail || {};
      if (!invitation?.id || !acceptedBy) return;
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitation.id ? { ...i, status: 'ACCEPTED' } : i))
      );
    };
    window.addEventListener('invitation:new', handleNew);
    window.addEventListener('invitation:accepted', handleAccepted);
    return () => {
      window.removeEventListener('invitation:new', handleNew);
      window.removeEventListener('invitation:accepted', handleAccepted);
    };
  }, []);

  useEffect(() => {
    if (!isCloudMode() || !currentUser) return;

    let mounted = true;
    let intervalId;

    async function pollInvitations() {
      try {
        const { notificationsApi } = await import('@/services/cloudClient');
        const result = await notificationsApi.list();
        const data = result.notifications || result || [];
        const incoming = Array.isArray(data) ? data : [];
        const inviteNotifs = incoming.filter(
          (n) => n.type === 'INVITATION' && n.metadata?.status === 'PENDING'
        );
        if (!mounted) return;
        setInvitations(inviteNotifs.map((notif) => notificationToInvitation(notif, currentUser)));
      } catch (err) {
        console.warn('[Invite] Poll notifications failed:', err?.message);
      }
    }

    pollInvitations();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') pollInvitations();
    };
    intervalId = setInterval(refreshWhenVisible, 5000);
    window.addEventListener('focus', pollInvitations);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', pollInvitations);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [currentUser]);

  const userInvitations = useMemo(() => {
    if (!currentUser?.email) return [];
    const currentEmail = normalizeEmail(currentUser.email);
    return invitations.filter(
      (inv) => normalizeEmail(inv.inviteeEmail) === currentEmail && inv.status === 'PENDING'
    );
  }, [invitations, currentUser]);

  const sendInvitation = useCallback(async (workspaceId, inviteeEmail, role, teamIds = []) => {
    if (!currentUser || !isCloudMode()) return null;

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
      usage: { ...usage, memberCount: usage.memberCount + 1 },
    });
    if (!capacity.allowed) {
      showToast('error', capacity.message);
      return null;
    }
    if (capacity.warning) {
      showToast('info', capacity.message);
    }

    const { invitationsApi } = await import('@/services/cloudClient');
    try {
      const normalizedInviteeEmail = normalizeEmail(inviteeEmail);
      const result = await invitationsApi.send({
        workspaceId,
        workspaceName: workspace.name,
        inviteeEmail: normalizedInviteeEmail,
        role: role || 'EMPLOYEE',
        teamIds: Array.from(new Set(teamIds || [])),
      });
      const notification = result.notification || result?.data?.notification;
      const createdInvitation = notification
        ? notificationToInvitation(notification, { email: normalizedInviteeEmail })
        : null;

      if (createdInvitation) {
        setInvitations((prev) => {
          if (prev.some((item) => item.id === createdInvitation.id)) return prev;
          return [...prev, createdInvitation];
        });
        const sock = getGlobalSocket();
        if (sock?.connected) {
          sock.emit('invitation:send', { inviteeEmail: normalizedInviteeEmail, invitation: createdInvitation });
        }
      }

      addActivity('invitation_sent', 'Invitation sent to ' + normalizedInviteeEmail);
      showToast('success', teamIds?.length ? 'Invitation sent and assigned to selected teams.' : 'Invitation sent to ' + normalizedInviteeEmail);
      return createdInvitation || result;
    } catch (err) {
      console.error('[Invite] Failed to send invitation via API:', err);
      showToast('error', err?.message || 'Failed to send invitation. Please try again.');
      return null;
    }
  }, [currentUser, workspaces, workspaceMeetings, addActivity, showToast]);

  const acceptInvitation = useCallback(async (invitationId) => {
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv || !currentUser || !isCloudMode()) return;

    try {
      const { notificationsApi, workspacesApi } = await import('@/services/cloudClient');
      await notificationsApi.update(invitationId, { action: 'accept' });
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: 'ACCEPTED' } : i))
      );

      const wsList = await workspacesApi.list({ userId: currentUser.id });
      const nextWorkspaces = Array.isArray(wsList) ? wsList : [];
      setWorkspaces(nextWorkspaces);

      const targetWs = nextWorkspaces.find((w) => w.id === inv.workspaceId);
      setActiveWorkspaceId(inv.workspaceId);
      const general = targetWs?.channels?.find((c) => c.isDefault && c.type === 'text') || targetWs?.channels?.[0];
      setActiveChannelId(general?.id || null);
      setActiveTeamId(null);
      setActiveView('home');

      const sock = getGlobalSocket();
      if (sock?.connected) {
        sock.emit('invitation:accept', { fromUserId: currentUser.id, invitation: inv });
      }

      addActivity('invitation_accepted', 'Joined workspace ' + (inv.workspaceName || ''));
      showToast('success', 'You have joined "' + (inv.workspaceName || 'Workspace') + '"!');
    } catch (err) {
      showToast('error', err?.message || 'Failed to accept invitation.');
    }
  }, [invitations, currentUser, setWorkspaces, setActiveWorkspaceId, setActiveChannelId, setActiveTeamId, setActiveView, addActivity, showToast]);

  const declineInvitation = useCallback(async (invitationId) => {
    if (!isCloudMode()) return;
    try {
      const { notificationsApi } = await import('@/services/cloudClient');
      await notificationsApi.update(invitationId, { action: 'decline' });
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: 'DECLINED' } : i))
      );
    } catch (err) {
      showToast('error', err?.message || 'Failed to decline invitation.');
    }
  }, [showToast]);

  return {
    invitations,
    setInvitations,
    userInvitations,
    sendInvitation,
    acceptInvitation,
    declineInvitation,
  };
}
