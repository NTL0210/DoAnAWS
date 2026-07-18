'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { isCloudMode } from '@/services/apiClient';

// â”€â”€â”€ Hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import useAuthState, { getSessionApiToken, toHydratedUser } from '@/hooks/workspace/useAuthState';
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

// â”€â”€â”€ Module-level constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WorkspaceContext = createContext(null);
const STORAGE_KEYS = {
  workspaces: 'meetingAppWorkspaces',
  messages: 'meetingAppMessages',
  tasks: 'meetingAppWorkspaceTasks',
  meetings: 'meetingAppWorkspaceMeetings',
  trash: 'meetingAppWorkspaceTrash',
};
const LOCAL_DATA_KEYS_TO_PURGE = [
  'meetingAppUser',
  'user',
  'meetingAppInvitations',
  'activeWorkspaceId',
  'activeChannelId',
  ...Object.values(STORAGE_KEYS),
];
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
 * WorkspaceProvider â€” wraps the entire app
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
  // â”€â”€â”€ Call all hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const authHook = useAuthState();
  const toastHook = useToastState();
  const onboardingHook = useOnboardingState();

  // Activity feed â€” addActivity does NOT need activeWorkspaceId (only addNotification does).
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
    addNotification: activityHook.addNotification,
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

  // â”€â”€â”€ Sync active workspace for notifications (break circular dep) â”€â”€â”€â”€
  useEffect(() => {
    activityHook.syncActiveWorkspaceId(workspaceHook.activeWorkspaceId);
  }, [activityHook.syncActiveWorkspaceId, workspaceHook.activeWorkspaceId]);

  // â”€â”€â”€ UI State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [workspaceStorageHydrated, setWorkspaceStorageHydrated] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const lastWorkspaceLoadUserRef = useRef(null);
  const notificationCount = useMemo(
    () => activityHook.aiNotifications.filter((item) => item.isRead === false || item.unread).length,
    [activityHook.aiNotifications]
  );

  // â”€â”€â”€ Local refs to commonly-used hook values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { showToast } = toastHook;

  // â”€â”€â”€ Voice State (extracted to hook) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const voiceHook = useVoiceState({
    currentUser: authHook.currentUser,
    voiceChannels: workspaceHook.voiceChannels,
    workspaceRole: workspaceHook.workspaceRole,
    activeWorkspaceId: workspaceHook.activeWorkspaceId,
    workspaceMembers: workspaceHook.workspaceMembers,
    canManageAIReview: workspaceHook.canManageAIReview,
    canAccessVoice: rolesPermissionsHook.canAccessVoice,
    canRecordVoice: rolesPermissionsHook.canRecordVoice,
    setWorkspaces: workspaceHook.setWorkspaces,
    setWorkspaceMeetings: tasksHook.setWorkspaceMeetings,
    showToast,
    addActivity: activityHook.addActivity,
  });

  // â”€â”€â”€ Initialize from localStorage or Cloud session â”€â”€â”€â”€
  useEffect(() => {
    let cancelled = false;
    const loadWorkspaceState = async () => {
      try {
        LOCAL_DATA_KEYS_TO_PURGE.forEach((key) => localStorage.removeItem(key));
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('meetingApp')) keysToRemove.push(key);
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        if (cancelled) return;

        // Restore session
        if (isCloudMode()) {
          const { getAuthToken, setAuthToken } = await import('@/services/apiClient');
          try {
            const { fetchAuthSession } = await import('aws-amplify/auth');
            const sessionToken = getSessionApiToken(await fetchAuthSession());
            if (sessionToken) setAuthToken(sessionToken);
          } catch {
            // Fall back to the token already persisted by the app.
          }

          const token = getAuthToken();
          if (token) {
            try {
              const { authApi, workspacesApi } = await import('@/services/cloudClient');
              const result = await authApi.me();
              const user = result?.user || result;
              if (user?.id) {
                const hydratedUser = toHydratedUser(user);
                authHook.setCurrentUser(hydratedUser);

                // Load workspaces from cloud API
                try {
                  const wsList = await workspacesApi.list({ userId: user.id });
                  workspaceHook.setWorkspaces(Array.isArray(wsList) ? wsList : []);
                } catch (wsErr) {
                  workspaceHook.setWorkspaces([]);
                }

                if (!cancelled) setWorkspaceStorageHydrated(true);
                return;
              }
            } catch {
              const { clearAuthToken } = await import('@/services/apiClient');
              clearAuthToken();
            }
          }
        }

      } catch {
        workspaceHook.setWorkspaces([]);
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

  useEffect(() => {
    if (!workspaceStorageHydrated) return;
    if (!isCloudMode()) return;
    const userId = authHook.currentUser?.id;
    if (!userId) {
      lastWorkspaceLoadUserRef.current = null;
      return;
    }
    if (lastWorkspaceLoadUserRef.current === userId) return;

    let cancelled = false;
    lastWorkspaceLoadUserRef.current = userId;

    const loadUserWorkspaces = async () => {
      try {
        const { workspacesApi } = await import('@/services/cloudClient');
        const wsList = await workspacesApi.list({ userId });
        if (!cancelled) {
          workspaceHook.setWorkspaces(Array.isArray(wsList) ? wsList : []);
        }
      } catch {
        if (!cancelled) {
          workspaceHook.setWorkspaces([]);
        }
      }
    };

    loadUserWorkspaces();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceStorageHydrated, authHook.currentUser?.id]);

  // â”€â”€â”€ Storage persistence effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€â”€ Cloud API sync (debounced) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Persist workspace sub-entities (teams, channels, messages, voice)
  // to DynamoDB via cloud API whenever they change.
  // Workspace changes are persisted by the explicit action that made them.
  // A background PATCH loop causes stale expectedVersion conflicts after reloads.

  // â”€â”€â”€ Auto-select workspace when user logs in â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (authHook.currentUser && !workspaceHook.activeWorkspaceId) {
      const userWs = workspaceHook.workspaces.filter((ws) =>
        ws.members.some((m) => m.userId === authHook.currentUser.id)
      );
      if (userWs.length > 0) {
        workspaceHook.setActiveWorkspaceId(userWs[0].id);
        const general = userWs[0].channels?.find(
          (c) => c.isDefault && c.type === 'text'
        );
        if (general) workspaceHook.setActiveChannelId(general.id);
      }
    }
  }, [authHook.currentUser, workspaceHook.workspaces, workspaceHook.activeWorkspaceId]);

  // â”€â”€â”€ Persist workspace selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€â”€ Voice functions moved to useVoiceState hook â”€â”€â”€â”€â”€â”€

  // â”€â”€â”€ Context Value â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      typingUsers: channelsMessagesHook.typingUsers,
      sendMessage: channelsMessagesHook.sendMessage,
      sendTeamMessage: channelsMessagesHook.sendTeamMessage,
      sendTyping: channelsMessagesHook.sendTyping,

      // Tasks (shared between Kanban and AI)
      workspaceTasks: tasksHook.workspaceTasks,
      addWorkspaceTasks: tasksHook.addWorkspaceTasks,
      moveWorkspaceTask: tasksHook.moveWorkspaceTask,
      deleteWorkspaceTask: tasksHook.deleteWorkspaceTask,
      refreshWorkspaceExecutionData: tasksHook.refreshWorkspaceExecutionData,
      trashItems: tasksHook.trashItems,
      restoreTrashItem: tasksHook.restoreTrashItem,
      permanentlyDeleteTrashItem: tasksHook.permanentlyDeleteTrashItem,

      // Meetings / AI workflow
      workspaceMeetings: tasksHook.workspaceMeetings,
      meetings: tasksHook.workspaceMeetings,
      setMeetings: tasksHook.setWorkspaceMeetings,
      createMeeting: tasksHook.createMeeting,
      deleteMeeting: tasksHook.deleteMeeting,
      uploadMeetingFile: tasksHook.uploadMeetingFile,
      analyzeMeetingWithAI: tasksHook.analyzeMeetingWithAI,
      processMeetingWithAI: tasksHook.processMeetingWithAI,
      reAnalyzeMeeting: tasksHook.reAnalyzeMeeting,
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
      tasksHook.deleteWorkspaceTask,
      tasksHook.refreshWorkspaceExecutionData,
      tasksHook.trashItems, tasksHook.restoreTrashItem, tasksHook.permanentlyDeleteTrashItem,
      tasksHook.workspaceMeetings, tasksHook.setWorkspaceMeetings,
      tasksHook.createMeeting, tasksHook.deleteMeeting, tasksHook.uploadMeetingFile,
      tasksHook.analyzeMeetingWithAI, tasksHook.processMeetingWithAI,
      tasksHook.reAnalyzeMeeting,
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
    throw new Error('useWorkspace doit Ãªtre utilisÃ© dans un WorkspaceProvider');
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
