'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  DEFAULT_ROLES,
  getUserWorkspacePermissions,
  getWorkspaceRole,
  hasWorkspacePermission,
  createInitialActivity,
} from '@/lib/workspaceData';
import {
  MAX_VOICE_RECORDING_SIZE_BYTES,
  WARNING_VOICE_RECORDING_SIZE_BYTES,
} from '@/lib/voicePermissions';
import { isCloudMode, isMockMode } from '@/services/apiClient';

// ─── Hooks ────────────────────────────────────────────────
import useAuthState, { toHydratedUser } from '@/hooks/workspace/useAuthState';
import useToastState from '@/hooks/workspace/useToastState';
import useOnboardingState from '@/hooks/workspace/useOnboardingState';
import useActivityFeed from '@/hooks/workspace/useActivityFeed';
import useWorkspaceState from '@/hooks/workspace/useWorkspaceState';
import useChannelsAndMessages from '@/hooks/workspace/useChannelsAndMessages';
import useInvitationsState from '@/hooks/workspace/useInvitationsState';
import useWorkspaceTasksState from '@/hooks/workspace/useWorkspaceTasksState';
import useMembersAndTeams from '@/hooks/workspace/useMembersAndTeams';
import useRolesAndPermissions from '@/hooks/workspace/useRolesAndPermissions';
import useVoiceState from '@/hooks/workspace/useVoiceState';

// ─── Module-level constants ───────────────────────────────
const WorkspaceContext = createContext(null);
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEYS = {
  workspaces: 'meetingAppWorkspaces',
  messages: 'meetingAppMessages',
  tasks: 'meetingAppWorkspaceTasks',
  meetings: 'meetingAppWorkspaceMeetings',
  trash: 'meetingAppWorkspaceTrash',
};
/** Legacy mock-repo keys to purge — passwords were cached here */
const LEGACY_MOCK_STORAGE_KEYS = [
  'meetingAppMockUsers',
  'meetingAppMockWorkspaces',
  'meetingAppMockTasks',
  'meetingAppMockMeetings',
];
const EMPTY_TRASH = { tasks: [], meetings: [], teams: [] };
const STORAGE_VERSION_KEY = 'meetingAppStorageVersion_v2';

const workspaceRoleLabels = {
  OWNER: 'Owner',
  VICE_ADMIN: 'Vice Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

const workspaceRoleColors = {
  OWNER: 'bg-red-100 text-red-700',
  VICE_ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  EMPLOYEE: 'bg-green-100 text-green-700',
};

/**
 * WorkspaceProvider — wraps the entire app
 *
 * Manages workspace-based SaaS state:
 *  - Account-only auth (no global roles)
 *  - Workspaces with teams, channels, members
 *  - Teams CRUD
 *  - Messages per channel
 *  - Invitations
 *  - Workspace-scoped role/permission checking
 *  - Onboarding checklist
 *  - Activity feed
 *  - Toast notifications
 */
export function WorkspaceProvider({ children }) {
  // ─── Call all hooks ────────────────────────────────────
  const authHook = useAuthState();
  const toastHook = useToastState();
  const onboardingHook = useOnboardingState();

  // Activity feed — addActivity does NOT need activeWorkspaceId (only addNotification does).
  // activeWorkspaceIdRef is synced after workspaceHook resolves the cycle.
  const activityHook = useActivityFeed({
    currentUser: authHook.currentUser,
  });

  const workspaceHook = useWorkspaceState({
    currentUser: authHook.currentUser,
    showToast: toastHook.showToast,
    addActivity: activityHook.addActivity,
    initOnboarding: onboardingHook.initOnboarding,
  });

  const channelsMessagesHook = useChannelsAndMessages({
    currentUser: authHook.currentUser,
    activeWorkspace: workspaceHook.activeWorkspace,
    activeWorkspaceId: workspaceHook.activeWorkspaceId,
    activeChannelId: workspaceHook.activeChannelId,
    activeTeamId: workspaceHook.activeTeamId,
    setWorkspaces: workspaceHook.setWorkspaces,
    addActivity: activityHook.addActivity,
    addNotification: activityHook.addNotification,
  });

  const tasksHook = useWorkspaceTasksState({
    currentUser: authHook.currentUser,
    activeWorkspace: workspaceHook.activeWorkspace,
    workspaceRole: workspaceHook.workspaceRole,
    canManageAIReview: workspaceHook.canManageAIReview,
    workspaceMembers: workspaceHook.workspaceMembers,
    activeWorkspaceId: workspaceHook.activeWorkspaceId,
    setWorkspaces: workspaceHook.setWorkspaces,
    addActivity: activityHook.addActivity,
    showToast: toastHook.showToast,
    completeOnboardingStep: onboardingHook.completeOnboardingStep,
  });

  const invitationsHook = useInvitationsState({
    currentUser: authHook.currentUser,
    workspaces: workspaceHook.workspaces,
    workspaceMeetings: tasksHook.workspaceMeetings,
    setWorkspaces: workspaceHook.setWorkspaces,
    setWorkspaceMeetings: tasksHook.setWorkspaceMeetings,
    setActiveWorkspaceId: workspaceHook.setActiveWorkspaceId,
    setActiveChannelId: workspaceHook.setActiveChannelId,
    setActiveTeamId: workspaceHook.setActiveTeamId,
    setActiveView: workspaceHook.setActiveView,
    addActivity: activityHook.addActivity,
    showToast: toastHook.showToast,
  });

  const membersTeamsHook = useMembersAndTeams({
    currentUser: authHook.currentUser,
    workspaces: workspaceHook.workspaces,
    workspaceMeetings: tasksHook.workspaceMeetings,
    setWorkspaces: workspaceHook.setWorkspaces,
    setWorkspaceMeetings: tasksHook.setWorkspaceMeetings,
    addActivity: activityHook.addActivity,
    showToast: toastHook.showToast,
    completeOnboardingStep: onboardingHook.completeOnboardingStep,
  });

  const rolesPermissionsHook = useRolesAndPermissions({
    currentUser: authHook.currentUser,
    workspaces: workspaceHook.workspaces,
    activeWorkspace: workspaceHook.activeWorkspace,
    workspaceRole: workspaceHook.workspaceRole,
    workspaceTeams: workspaceHook.workspaceTeams,
    workspaceMembers: workspaceHook.workspaceMembers,
    setWorkspaces: workspaceHook.setWorkspaces,
  });

  // ─── Sync activeWorkspaceIdRef (break circular dep) ────
  activityHook.activeWorkspaceIdRef.current = workspaceHook.activeWorkspaceId;

  // ─── UI State ──────────────────────────────────────────
  const [workspaceStorageHydrated, setWorkspaceStorageHydrated] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationCount = useMemo(
    () => activityHook.aiNotifications.filter((item) => item.isRead === false || item.unread).length,
    [activityHook.aiNotifications]
  );

  // ─── Local refs to commonly-used hook values ──────────
  const { showToast } = toastHook;

  // ─── Voice State (extracted to hook) ──────────────────
  const voiceHook = useVoiceState({
    currentUser: authHook.currentUser,
    voiceChannels: workspaceHook.voiceChannels,
    workspaceRole: workspaceHook.workspaceRole,
    activeWorkspaceId: workspaceHook.activeWorkspaceId,
    canManageAIReview: workspaceHook.canManageAIReview,
    canAccessVoice: rolesPermissionsHook.canAccessVoice,
    canRecordVoice: rolesPermissionsHook.canRecordVoice,
    setWorkspaces: workspaceHook.setWorkspaces,
    setWorkspaceMeetings: tasksHook.setWorkspaceMeetings,
    showToast,
    addActivity: activityHook.addActivity,
  });

  // ─── Initialize from localStorage or Cloud session ────
  useEffect(() => {
    let cancelled = false;
    const loadWorkspaceState = async () => {
      try {
        // One-time cache clear: purge stale localStorage data from the mock-data era
        if (!localStorage.getItem(STORAGE_VERSION_KEY)) {
          Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
          LEGACY_MOCK_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
          localStorage.setItem(STORAGE_VERSION_KEY, '1');
        }

        const storedWorkspaces = localStorage.getItem(STORAGE_KEYS.workspaces);
        const storedMessages = localStorage.getItem(STORAGE_KEYS.messages);
        const storedTasks = localStorage.getItem(STORAGE_KEYS.tasks);
        const storedMeetings = localStorage.getItem(STORAGE_KEYS.meetings);
        const storedTrash = localStorage.getItem(STORAGE_KEYS.trash);

        if (cancelled) return;
        if (storedWorkspaces) workspaceHook.setWorkspaces(JSON.parse(storedWorkspaces));
        if (storedMessages) channelsMessagesHook.setMessages(JSON.parse(storedMessages));
        if (storedMeetings) tasksHook.setWorkspaceMeetings(JSON.parse(storedMeetings));
        if (storedTrash) tasksHook.setTrashItems({ ...EMPTY_TRASH, ...JSON.parse(storedTrash) });
        if (storedTasks) tasksHook.setWorkspaceTasks(JSON.parse(storedTasks));

        // Restore session
        if (isCloudMode()) {
          const { getAuthToken } = await import('@/services/apiClient');
          const token = getAuthToken();
          if (token) {
            try {
              const { authApi } = await import('@/services/cloudClient');
              const result = await authApi.me();
              const user = result?.user || result;
              if (user?.id) {
                const hydratedUser = toHydratedUser(user);
                authHook.setCurrentUser(hydratedUser);
                localStorage.setItem('meetingAppUser', JSON.stringify({
                  user: hydratedUser,
                  createdAt: Date.now(),
                  expiresAt: Date.now() + SESSION_TTL_MS,
                }));
                localStorage.setItem('user', JSON.stringify(hydratedUser));
                if (!cancelled) setWorkspaceStorageHydrated(true);
                return;
              }
            } catch {
              const { clearAuthToken } = await import('@/services/apiClient');
              clearAuthToken();
            }
          }
        }

        // Mock/API mode: restore user from localStorage
        const stored = localStorage.getItem('meetingAppUser');
        if (stored) {
          const session = JSON.parse(stored);
          const user = session?.user || session;
          if (session?.expiresAt && session.expiresAt <= Date.now()) {
            localStorage.removeItem('meetingAppUser');
            return;
          }
          const hydratedUser = toHydratedUser(user);
          authHook.setCurrentUser(hydratedUser);
          localStorage.setItem('user', JSON.stringify(hydratedUser));

          const savedWs = localStorage.getItem('activeWorkspaceId');
          if (savedWs) {
            workspaceHook.setActiveWorkspaceId(savedWs);
            const savedChannel = localStorage.getItem('activeChannelId_' + savedWs);
            if (savedChannel) workspaceHook.setActiveChannelId(savedChannel);
          }
        }
      } catch {
        // Mock storage is best-effort. Fall back to seed data.
      } finally {
        if (!cancelled) {
          authHook.setLoading(false);
          setWorkspaceStorageHydrated(true);
        }
      }
    };

    loadWorkspaceState();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Storage persistence effects ───────────────────────
  useEffect(() => {
    if (!workspaceStorageHydrated) return;
    localStorage.setItem(STORAGE_KEYS.workspaces, JSON.stringify(workspaceHook.workspaces));
  }, [workspaceStorageHydrated, workspaceHook.workspaces]);

  useEffect(() => {
    if (!workspaceStorageHydrated) return;
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(channelsMessagesHook.messages));
  }, [workspaceStorageHydrated, channelsMessagesHook.messages]);

  useEffect(() => {
    if (!workspaceStorageHydrated) return;
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasksHook.workspaceTasks));
  }, [workspaceStorageHydrated, tasksHook.workspaceTasks]);

  useEffect(() => {
    if (!workspaceStorageHydrated) return;
    localStorage.setItem(STORAGE_KEYS.meetings, JSON.stringify(tasksHook.workspaceMeetings));
  }, [workspaceStorageHydrated, tasksHook.workspaceMeetings]);

  useEffect(() => {
    if (!workspaceStorageHydrated) return;
    localStorage.setItem(STORAGE_KEYS.trash, JSON.stringify(tasksHook.trashItems));
  }, [workspaceStorageHydrated, tasksHook.trashItems]);

  // ─── Auto-select workspace when user logs in ──────────
  useEffect(() => {
    if (authHook.currentUser && !workspaceHook.activeWorkspaceId) {
      const userWs = workspaceHook.workspaces.filter((ws) =>
        ws.members.some((m) => m.userId === authHook.currentUser.id)
      );
      if (userWs.length > 0) {
        workspaceHook.setActiveWorkspaceId(userWs[0].id);
        const general = userWs[0].channels.find(
          (c) => c.isDefault && c.type === 'text'
        );
        if (general) workspaceHook.setActiveChannelId(general.id);
      }
    }
  }, [authHook.currentUser, workspaceHook.workspaces, workspaceHook.activeWorkspaceId]);

  // ─── Persist workspace selection ───────────────────────
  useEffect(() => {
    if (workspaceHook.activeWorkspaceId) {
      localStorage.setItem('activeWorkspaceId', workspaceHook.activeWorkspaceId);
    }
  }, [workspaceHook.activeWorkspaceId]);

  useEffect(() => {
    if (workspaceHook.activeWorkspaceId && workspaceHook.activeChannelId) {
      localStorage.setItem('activeChannelId_' + workspaceHook.activeWorkspaceId, workspaceHook.activeChannelId);
    }
  }, [workspaceHook.activeWorkspaceId, workspaceHook.activeChannelId]);

  // ─── Voice functions moved to useVoiceState hook ──────

  // ─── Context Value ─────────────────────────────────────
  // Matches the EXACT shape from the original monolithic provider.
  const value = useMemo(
    () => ({
      // Auth (account-only, no global role)
      currentUser: authHook.currentUser,
      loading: authHook.loading,
      login: authHook.login,
      register: authHook.register,
      setUser: authHook.setUser,
      updateCurrentUser: authHook.updateCurrentUser,
      logout: authHook.logout,

      // Workspace
      workspaces: workspaceHook.workspaces,
      activeWorkspaceId: workspaceHook.activeWorkspaceId,
      activeWorkspace: workspaceHook.activeWorkspace,
      selectWorkspace: workspaceHook.selectWorkspace,
      createWorkspace: workspaceHook.createWorkspace,
      activeTeamId: workspaceHook.activeTeamId,
      activeTeam: workspaceHook.activeTeam,

      // Workspace-scoped role (ONLY source of truth)
      workspaceRole: workspaceHook.workspaceRole,
      workspaceRoleLabels,
      workspaceRoleColors,

      // Views
      activeView: workspaceHook.activeView,
      selectView: workspaceHook.selectView,
      activeChannelId: workspaceHook.activeChannelId,
      activeVoiceChannelId: voiceHook.activeVoiceChannelId,
      activeChannel: workspaceHook.activeChannel,
      selectChannel: workspaceHook.selectChannel,
      selectTeamChat: workspaceHook.selectTeamChat,

      // Channels
      textChannels: workspaceHook.textChannels,
      voiceChannels: workspaceHook.voiceChannels,
      createChannel: channelsMessagesHook.createChannel,
      deleteChannel: channelsMessagesHook.deleteChannel,

      // Voice presence, recording, permissions
      voiceParticipants: voiceHook.voiceParticipants,
      activeVoiceRecordings: voiceHook.activeVoiceRecordings,
      voiceRecords: voiceHook.voiceRecords,
      maxVoiceRecordingSizeBytes: MAX_VOICE_RECORDING_SIZE_BYTES,
      warningVoiceRecordingSizeBytes: WARNING_VOICE_RECORDING_SIZE_BYTES,
      canAccessVoice: rolesPermissionsHook.canAccessVoice,
      canRecordVoice: rolesPermissionsHook.canRecordVoice,
      updateVoiceParticipantState: voiceHook.updateVoiceParticipantState,
      syncVoiceParticipant: voiceHook.syncVoiceParticipant,
      removeVoiceParticipant: voiceHook.removeVoiceParticipant,
      setVoiceChannelParticipants: voiceHook.setVoiceChannelParticipants,
      joinVoiceChannel: voiceHook.joinVoiceChannel,
      leaveVoiceChannel: voiceHook.leaveVoiceChannel,
      switchVoiceChannel: voiceHook.switchVoiceChannel,
      getCurrentUserVoiceChannel: voiceHook.getCurrentUserVoiceChannel,
      isCurrentUserInVoice: voiceHook.isCurrentUserInVoice,
      removeUserFromAllVoiceChannels: voiceHook.removeUserFromAllVoiceChannels,
      startVoiceRecording: voiceHook.startVoiceRecording,
      stopVoiceRecording: voiceHook.stopVoiceRecording,
      getActiveVoiceRecordingMetrics: voiceHook.getActiveVoiceRecordingMetrics,
      updateVoiceChannelPermissions: voiceHook.updateVoiceChannelPermissions,
      addTeamToVoiceChannel: voiceHook.addTeamToVoiceChannel,
      removeTeamFromVoiceChannel: voiceHook.removeTeamFromVoiceChannel,
      addUserToVoiceChannel: voiceHook.addUserToVoiceChannel,
      removeUserFromVoiceChannel: voiceHook.removeUserFromVoiceChannel,
      toggleVoiceChannelLock: voiceHook.toggleVoiceChannelLock,
      toggleVoiceRecordingPermission: voiceHook.toggleVoiceRecordingPermission,
      sendVoiceRecordToAI: voiceHook.sendVoiceRecordToAI,
      deleteVoiceRecord: voiceHook.deleteVoiceRecord,

      // Messages
      channelMessages: channelsMessagesHook.channelMessages,
      teamMessagesKey: channelsMessagesHook.teamMessagesKey,
      activeTeamMessages: channelsMessagesHook.activeTeamMessages,
      sendMessage: channelsMessagesHook.sendMessage,
      sendTeamMessage: channelsMessagesHook.sendTeamMessage,

      // Tasks (shared between Kanban and AI)
      workspaceTasks: tasksHook.workspaceTasks,
      addWorkspaceTasks: tasksHook.addWorkspaceTasks,
      moveWorkspaceTask: tasksHook.moveWorkspaceTask,
      trashItems: tasksHook.trashItems,
      restoreTrashItem: tasksHook.restoreTrashItem,
      permanentlyDeleteTrashItem: tasksHook.permanentlyDeleteTrashItem,

      // Meetings / AI workflow
      workspaceMeetings: tasksHook.workspaceMeetings,
      meetings: tasksHook.workspaceMeetings,
      setMeetings: tasksHook.setWorkspaceMeetings,
      createMeeting: tasksHook.createMeeting,
      uploadMeetingMock: tasksHook.uploadMeetingMock,
      analyzeMeetingWithAI: tasksHook.analyzeMeetingWithAI,
      processMeetingWithAI: tasksHook.processMeetingWithAI,
      updateSuggestedTask: tasksHook.updateSuggestedTask,
      updateMeetingSuggestion: tasksHook.updateMeetingSuggestion,
      toggleSuggestedTaskSelection: tasksHook.toggleSuggestedTaskSelection,
      removeMeetingSuggestion: tasksHook.removeMeetingSuggestion,
      createTasksFromSuggestions: tasksHook.createTasksFromSuggestions,
      createTasksFromMeeting: tasksHook.createTasksFromMeeting,
      getTasksByMeeting: tasksHook.getTasksByMeeting,

      // Members
      workspaceMembers: workspaceHook.workspaceMembers,
      updateMemberRole: membersTeamsHook.updateMemberRole,
      removeMember: membersTeamsHook.removeMember,

      // Teams
      workspaceTeams: workspaceHook.workspaceTeams,
      canAccessTeam: workspaceHook.canAccessTeam,
      createTeam: membersTeamsHook.createTeam,
      updateTeam: membersTeamsHook.updateTeam,
      deleteTeam: membersTeamsHook.deleteTeam,
      addMemberToTeam: membersTeamsHook.addMemberToTeam,
      removeMemberFromTeam: membersTeamsHook.removeMemberFromTeam,
      assignTeamManager: membersTeamsHook.assignTeamManager,

      // Invitations
      invitations: invitationsHook.invitations,
      userInvitations: invitationsHook.userInvitations,
      sendInvitation: invitationsHook.sendInvitation,
      acceptInvitation: invitationsHook.acceptInvitation,
      declineInvitation: invitationsHook.declineInvitation,
      showInvitations,
      setShowInvitations,

      // Roles
      createCustomRole: rolesPermissionsHook.createCustomRole,

      // Permissions (workspace-scoped)
      can: rolesPermissionsHook.can,
      canInWorkspace: rolesPermissionsHook.canInWorkspace,
      getAllPermissions: rolesPermissionsHook.getAllPermissions,

      // Onboarding
      onboarding: onboardingHook.onboarding,
      initOnboarding: onboardingHook.initOnboarding,
      completeOnboardingStep: onboardingHook.completeOnboardingStep,
      dismissOnboarding: onboardingHook.dismissOnboarding,

      // Activity
      activityFeed: activityHook.activityFeed,
      addActivity: activityHook.addActivity,

      // Notifications
      aiNotifications: activityHook.aiNotifications,
      addNotification: activityHook.addNotification,
      markNotificationRead: activityHook.markNotificationRead,
      markAllNotificationsRead: activityHook.markAllNotificationsRead,
      workspaceNotificationsEnabled: activityHook.workspaceNotificationsEnabled,
      workspaceNotificationSettings: activityHook.workspaceNotificationSettings,
      setWorkspaceNotificationsEnabled: activityHook.setWorkspaceNotificationsEnabled,
      toggleWorkspaceNotifications: activityHook.toggleWorkspaceNotifications,

      // Toast
      toasts: toastHook.toasts,
      showToast: toastHook.showToast,
      dismissToast: toastHook.dismissToast,

      // UI
      showUserMenu, setShowUserMenu,
      showCreateChannel, setShowCreateChannel,
      showCreateWorkspace, setShowCreateWorkspace,
      showCreateTeam, setShowCreateTeam,
      showInviteMember, setShowInviteMember,
      showNotifications, setShowNotifications,
      notificationCount,
    }),
    [
      // Auth
      authHook.currentUser, authHook.loading, authHook.login, authHook.register,
      authHook.setUser, authHook.updateCurrentUser, authHook.logout,
      // Workspace
      workspaceHook.workspaces, workspaceHook.activeWorkspaceId, workspaceHook.activeWorkspace,
      workspaceHook.selectWorkspace, workspaceHook.createWorkspace,
      workspaceHook.activeTeamId, workspaceHook.activeTeam,
      workspaceHook.workspaceRole,
      workspaceHook.activeView, workspaceHook.selectView,
      workspaceHook.activeChannelId, workspaceHook.activeChannel,
      workspaceHook.selectChannel, workspaceHook.selectTeamChat,
      workspaceHook.textChannels, workspaceHook.voiceChannels,
      workspaceHook.workspaceMembers, workspaceHook.workspaceTeams,
      workspaceHook.canAccessTeam,
      // Channels/Messages
      channelsMessagesHook.channelMessages, channelsMessagesHook.teamMessagesKey,
      channelsMessagesHook.activeTeamMessages, channelsMessagesHook.createChannel,
      channelsMessagesHook.deleteChannel, channelsMessagesHook.sendMessage,
      channelsMessagesHook.sendTeamMessage,
      // Voice
      voiceHook,
      rolesPermissionsHook.canAccessVoice, rolesPermissionsHook.canRecordVoice,
      // Tasks
      tasksHook.workspaceTasks, tasksHook.addWorkspaceTasks, tasksHook.moveWorkspaceTask,
      tasksHook.trashItems, tasksHook.restoreTrashItem, tasksHook.permanentlyDeleteTrashItem,
      tasksHook.workspaceMeetings, tasksHook.setWorkspaceMeetings,
      tasksHook.createMeeting, tasksHook.uploadMeetingMock,
      tasksHook.analyzeMeetingWithAI, tasksHook.processMeetingWithAI,
      tasksHook.updateSuggestedTask, tasksHook.updateMeetingSuggestion,
      tasksHook.toggleSuggestedTaskSelection, tasksHook.removeMeetingSuggestion,
      tasksHook.createTasksFromSuggestions, tasksHook.createTasksFromMeeting,
      tasksHook.getTasksByMeeting,
      // Members/Teams
      membersTeamsHook.updateMemberRole, membersTeamsHook.removeMember,
      membersTeamsHook.createTeam, membersTeamsHook.updateTeam,
      membersTeamsHook.deleteTeam, membersTeamsHook.addMemberToTeam,
      membersTeamsHook.removeMemberFromTeam, membersTeamsHook.assignTeamManager,
      // Invitations
      invitationsHook.invitations, invitationsHook.userInvitations,
      invitationsHook.sendInvitation, invitationsHook.acceptInvitation,
      invitationsHook.declineInvitation,
      showInvitations,
      // Roles/Permissions
      rolesPermissionsHook.createCustomRole, rolesPermissionsHook.can,
      rolesPermissionsHook.canInWorkspace, rolesPermissionsHook.getAllPermissions,
      // Onboarding
      onboardingHook.onboarding, onboardingHook.initOnboarding,
      onboardingHook.completeOnboardingStep, onboardingHook.dismissOnboarding,
      // Activity
      activityHook.activityFeed, activityHook.addActivity,
      // Notifications
      activityHook.aiNotifications, activityHook.addNotification,
      activityHook.markNotificationRead, activityHook.markAllNotificationsRead,
      activityHook.workspaceNotificationsEnabled,
      activityHook.workspaceNotificationSettings,
      activityHook.setWorkspaceNotificationsEnabled,
      activityHook.toggleWorkspaceNotifications,
      // Toast
      toastHook.toasts, toastHook.showToast, toastHook.dismissToast,
      // UI
      showUserMenu, showCreateChannel, showCreateWorkspace,
      showCreateTeam, showInviteMember, showNotifications,
      notificationCount,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Hook to use workspace context
 */
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace doit être utilisé dans un WorkspaceProvider');
  }
  return ctx;
}

export default WorkspaceContext;

/**
 * Normalize a task suggestion with missing/confident flags
 */
function normalizeSuggestion(suggestion) {
  const missingFields = [];
  if (!suggestion.title || !suggestion.title.trim()) missingFields.push('title');
  if (!suggestion.assignee) missingFields.push('assignee');
  if (!suggestion.deadline) missingFields.push('deadline');
  return {
    ...suggestion,
    missingFields,
    needsConfirmation: missingFields.length > 0 || (suggestion.confidence || 0) < 0.7,
  };
}
