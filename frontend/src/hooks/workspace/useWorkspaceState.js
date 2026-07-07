'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { getWorkspaceRole } from '@/lib/workspaceData';
import { normalizeVoiceChannel } from '@/lib/voicePermissions';
import { canManageAIWorkflow } from '@/services/workspaceService';
import { isCloudMode } from '@/services/apiClient';

/**
 * useWorkspaceState — manages workspace state, derived values, and workspace/view actions.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @param {Function} params.showToast
 * @param {Function} params.addActivity
 * @param {Function} params.initOnboarding
 * @returns {{
 *   // State
 *   workspaces: Array,
 *   setWorkspaces: Function,
 *   activeWorkspaceId: string|null,
 *   setActiveWorkspaceId: Function,
 *   activeChannelId: string|null,
 *   setActiveChannelId: Function,
 *   activeTeamId: string|null,
 *   setActiveTeamId: Function,
 *   activeView: string|null,
 *   setActiveView: Function,
 *   // Derived
 *   activeWorkspace: Object|null,
 *   activeChannel: Object|null,
 *   activeTeam: Object|null,
 *   workspaceRole: string|null,
 *   canManageAIReview: boolean,
 *   textChannels: Array,
 *   voiceChannels: Array,
 *   workspaceMembers: Array,
 *   workspaceTeams: Array,
 *   canAccessTeam: (team: Object) => boolean,
 *   // Actions
 *   createWorkspace: (workspaceData: Object, options?: Object) => Object|null,
 *   selectWorkspace: (workspaceId: string) => void,
 *   selectChannel: (channelId: string|null) => void,
 *   selectView: (view: string|null) => void,
 *   selectTeamChat: (teamId: string) => void,
 * }}
 */
export default function useWorkspaceState({
  currentUser,
  showToast,
}) {
  // ─── Workspace State ───────────────────────────────────
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeView, setActiveView] = useState(null);

  // ─── Derived ───────────────────────────────────────────
  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || null;
  }, [workspaces, activeWorkspaceId]);

  const activeChannel = useMemo(() => {
    if (!activeWorkspace) return null;
    const channel = activeWorkspace.channels.find((c) => c.id === activeChannelId) || null;
    return channel?.type === 'voice' ? normalizeVoiceChannel(channel, activeWorkspace) : channel;
  }, [activeWorkspace, activeChannelId]);

  const activeTeam = useMemo(() => {
    if (!activeWorkspace || !activeTeamId) return null;
    return activeWorkspace.teams?.find((t) => t.id === activeTeamId) || null;
  }, [activeWorkspace, activeTeamId]);

  /** Workspace-scoped role — the ONLY source of truth for permissions */
  const workspaceRole = useMemo(() => {
    return getWorkspaceRole(activeWorkspace, currentUser?.id);
  }, [activeWorkspace, currentUser]);

  const canManageAIReview = useMemo(() => {
    return canManageAIWorkflow(workspaceRole);
  }, [workspaceRole]);

  const textChannels = useMemo(() => {
    if (!activeWorkspace) return [];
    return activeWorkspace.channels.filter((c) => c.type === 'text');
  }, [activeWorkspace]);

  const voiceChannels = useMemo(() => {
    if (!activeWorkspace) return [];
    return activeWorkspace.channels.filter((c) => c.type === 'voice').map((channel) => normalizeVoiceChannel(channel, activeWorkspace));
  }, [activeWorkspace]);

  const workspaceMembers = useMemo(() => {
    if (!activeWorkspace) return [];
    return (activeWorkspace.members || []).map((member) => {
      const isSelf = member.userId === currentUser?.id;
      return {
        ...member,
        name: member.name || member.nickname || (isSelf ? currentUser?.name : null) || member.email || member.userId || null,
        email: member.email || (isSelf ? currentUser?.email : null) || null,
        avatar: member.avatar || (isSelf ? currentUser?.avatar : null) || null,
      };
    });
  }, [activeWorkspace, currentUser]);

  useEffect(() => {
    if (!activeWorkspace || !isCloudMode()) return undefined;
    const missingProfileIds = Array.from(new Set(
      (activeWorkspace.members || [])
        .filter((member) => member.userId && member.userId !== currentUser?.id && (!member.name || !member.email))
        .map((member) => member.userId)
    ));
    if (missingProfileIds.length === 0) return undefined;

    let cancelled = false;
    async function hydrateMemberProfiles() {
      try {
        const { usersApi } = await import('@/services/cloudClient');
        const profiles = await Promise.all(
          missingProfileIds.map((userId) =>
            usersApi.get(userId).catch(() => null)
          )
        );
        if (cancelled) return;
        const byId = new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
        if (byId.size === 0) return;

        setWorkspaces((prev) => prev.map((workspace) => {
          if (workspace.id !== activeWorkspace.id) return workspace;
          return {
            ...workspace,
            members: (workspace.members || []).map((member) => {
              const profile = byId.get(member.userId);
              if (!profile) return member;
              return {
                ...member,
                name: member.name || profile.name || profile.email || member.userId,
                email: member.email || profile.email || null,
                avatar: member.avatar || profile.avatar || null,
              };
            }),
          };
        }));
      } catch {
        // Keep the userId fallback; member rendering must not fail if profile lookup is unavailable.
      }
    }

    hydrateMemberProfiles();
    return () => { cancelled = true; };
  }, [activeWorkspace, currentUser?.id]);

  const workspaceTeams = useMemo(() => {
    if (!activeWorkspace) return [];
    return activeWorkspace.teams || [];
  }, [activeWorkspace]);

  const canAccessTeam = useCallback((team) => {
    if (!team || !currentUser) return false;
    if (['OWNER', 'VICE_ADMIN', 'MANAGER'].includes(workspaceRole)) return true;
    return (team.memberIds || []).includes(currentUser.id);
  }, [currentUser, workspaceRole]);

  // ─── Workspace Actions ─────────────────────────────────
  const createWorkspace = useCallback(async (workspaceData) => {
    if (!currentUser) return null;

    if (!isCloudMode()) {
      showToast('error', 'Cloud API mode is required to create workspaces.');
      return null;
    }

    try {
      const { workspacesApi } = await import('@/services/cloudClient');
      const name = typeof workspaceData === 'string' ? workspaceData : workspaceData?.name;
      const saved = await workspacesApi.create({
        name,
        ownerId: currentUser.id,
        description: workspaceData?.description,
        workspaceType: workspaceData?.workspaceType,
        visibility: workspaceData?.visibility,
        iconColor: workspaceData?.iconColor,
      });
      if (saved?.id) {
        setWorkspaces((prev) => [...prev, saved]);
        setActiveWorkspaceId(saved.id);
        setActiveTeamId(null);
        const firstText = (saved.channels || []).find((c) => c.type === 'text');
        setActiveChannelId(firstText?.id || null);
        setActiveView('home');
        showToast('success', 'Workspace "' + saved.name + '" created successfully!');
        return saved;
      }
    } catch {
      showToast('error', 'Failed to create workspace. Please try again.');
      return null;
    }

    return null;
  }, [currentUser, showToast]);

  const selectWorkspace = useCallback((workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (ws) {
      const general = ws.channels.find((c) => c.isDefault && c.type === 'text') || ws.channels[0];
      setActiveChannelId(general?.id || null);
      setActiveTeamId(null);
      setActiveView('home');
    }
  }, [workspaces]);

  // ─── View Actions ──────────────────────────────────────
  const selectChannel = useCallback((channelId) => {
    setActiveChannelId(channelId);
    setActiveTeamId(null);
    setActiveView(null);
  }, []);

  const selectView = useCallback((view) => {
    setActiveView(view);
    setActiveChannelId(null);
    setActiveTeamId(null);
  }, []);

  const selectTeamChat = useCallback((teamId) => {
    setActiveTeamId(teamId);
    setActiveView('team-chat');
    setActiveChannelId(null);
  }, []);

  return {
    // State
    workspaces,
    setWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeChannelId,
    setActiveChannelId,
    activeTeamId,
    setActiveTeamId,
    activeView,
    setActiveView,
    // Derived
    activeWorkspace,
    activeChannel,
    activeTeam,
    workspaceRole,
    canManageAIReview,
    textChannels,
    voiceChannels,
    workspaceMembers,
    workspaceTeams,
    canAccessTeam,
    // Actions
    createWorkspace,
    selectWorkspace,
    selectChannel,
    selectView,
    selectTeamChat,
  };
}
