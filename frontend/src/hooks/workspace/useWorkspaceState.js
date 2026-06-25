'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  mockUsers,
  generateId,
  getWorkspaceRole,
} from '@/lib/workspaceData';
import { normalizeVoiceChannel } from '@/lib/voicePermissions';
import { canManageAIWorkflow, createCleanWorkspaceStructure } from '@/services/workspaceService';
import { createInitialActivity } from '@/lib/workspaceData';

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
  addActivity,
  initOnboarding,
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
      const profile = member.userId === currentUser?.id
        ? currentUser
        : mockUsers.find((user) => user.id === member.userId);
      return {
        ...member,
        name: member.name || member.nickname || profile?.name || null,
        email: member.email || profile?.email || null,
        avatar: member.avatar || profile?.avatar || null,
      };
    });
  }, [activeWorkspace, currentUser]);

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
  const createWorkspace = useCallback((workspaceData, options = {}) => {
    if (!currentUser) return null;

    const newWorkspace = createCleanWorkspaceStructure(workspaceData, currentUser.id, options);

    setWorkspaces((prev) => [...prev, newWorkspace]);
    setActiveWorkspaceId(newWorkspace.id);
    setActiveTeamId(null);

    // Auto-select first text channel
    const firstText = newWorkspace.channels.find((c) => c.type === 'text');
    setActiveChannelId(firstText?.id || null);
    setActiveView('home');

    showToast('success', 'Workspace "' + newWorkspace.name + '" created successfully!');

    return newWorkspace;
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
