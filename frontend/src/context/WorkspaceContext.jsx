'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  workspaces as defaultWorkspaces,
  mockMessages,
  mockWorkspaceMeetings,
  mockInvitations,
  userWorkspaces,
  DEFAULT_ROLES,
  generateId,
  generateWorkspaceSlug,
  hasWorkspacePermission,
  getUserWorkspacePermissions,
  getWorkspaceRole,
  createDefaultWorkspaceStructure,
  createInitialActivity,
} from '@/lib/workspaceData';
import { analyzeMeeting as serviceAnalyzeMeeting, uploadMeetingFile as serviceUploadMeetingFile } from '@/services/meetingService';
import { createVoiceRecord as serviceCreateVoiceRecord } from '@/services/voiceRecordingService';
import { createTasksFromSuggestions as buildTasksFromSuggestions, getTasksByMeeting as serviceGetTasksByMeeting } from '@/services/taskService';
import { canManageAIWorkflow } from '@/services/workspaceService';
import {
  MAX_VOICE_RECORDING_SIZE_BYTES,
  WARNING_VOICE_RECORDING_SIZE_BYTES,
  canAccessVoiceChannel,
  canRecordVoiceChannel,
  normalizeVoiceChannel,
  sanitizeVoiceFileName,
} from '@/lib/voicePermissions';
import {
  buildAudioConstraints,
  buildMediaRecorderOptions,
  createProcessedLocalRecordingStream,
  createProcessedRecordingStream,
} from '@/lib/voiceAudioQuality';

const WorkspaceContext = createContext(null);

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
  // ─── Auth State (account-only, no global role) ──────────
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Workspace State ───────────────────────────────────
  const [workspaces, setWorkspaces] = useState(defaultWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeView, setActiveView] = useState(null); // 'home' | 'tasks' | 'meetings' | 'analytics' | 'members' | 'teams' | 'settings' | 'team-chat' | null

  // ─── Messages ──────────────────────────────────────────
  const [messages, setMessages] = useState(mockMessages);

  // ─── Invitations ───────────────────────────────────────
  const [invitations, setInvitations] = useState(mockInvitations);

  // ─── Workspace Tasks (shared between meetings AI and Kanban) ──
  const [workspaceTasks, setWorkspaceTasks] = useState([]);
  const [workspaceMeetings, setWorkspaceMeetings] = useState(mockWorkspaceMeetings || []);
  const [voiceParticipants, setVoiceParticipants] = useState({});
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState(null);
  const [activeVoiceRecordings, setActiveVoiceRecordings] = useState({});
  const [voiceRecords, setVoiceRecords] = useState([]);
  const voiceRecordsRef = useRef([]);
  const mediaRecorderRefs = useRef({});
  const mediaStreamRefs = useRef({});
  const mediaChunkRefs = useRef({});
  const mediaCleanupRefs = useRef({});
  const [aiNotifications, setAiNotifications] = useState([]);
  const [workspaceNotificationSettings, setWorkspaceNotificationSettings] = useState({});

  // Initialize tasks from mock data
  useEffect(() => {
    const loadMockTasks = async () => {
      try {
        const { tasks: mockTasks } = await import('@/lib/mockData');
        if (mockTasks && mockTasks.length > 0) {
          setWorkspaceTasks(mockTasks);
        }
      } catch (e) {
        // Fallback: empty tasks
      }
    };
    loadMockTasks();
  }, []);

  useEffect(() => {
    voiceRecordsRef.current = voiceRecords;
  }, [voiceRecords]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('workspaceNotificationSettings');
      setWorkspaceNotificationSettings(stored ? JSON.parse(stored) : {});
    } catch {
      setWorkspaceNotificationSettings({});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('workspaceNotificationSettings', JSON.stringify(workspaceNotificationSettings));
    } catch {
      // Storage is best-effort.
    }
  }, [workspaceNotificationSettings]);

  // ─── Activity Feed ────────────────────────────────────
  const [activityFeed, setActivityFeed] = useState([]);

  // ─── Onboarding State ─────────────────────────────────
  const [onboarding, setOnboarding] = useState({
    showChecklist: false,
    steps: {
      invited: false,
      teamCreated: false,
      meetingUploaded: false,
      tasksReviewed: false,
      analyticsViewed: false,
    },
  });

  // ─── Toast State ──────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  // ─── UI State ──────────────────────────────────────────
  const [showInvitations, setShowInvitations] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationCount = useMemo(
    () => aiNotifications.filter((item) => item.isRead === false || item.unread).length,
    [aiNotifications]
  );

  // ─── Initialize from localStorage ──────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('meetingAppUser');
    if (stored) {
      try {
        // Mock-only client auth state. Do not store real access/refresh tokens in localStorage.
        const user = JSON.parse(stored);
        // Ensure user is account-only
        setCurrentUser({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        });

        const savedWs = localStorage.getItem('activeWorkspaceId');
        if (savedWs) {
          setActiveWorkspaceId(savedWs);
          const savedChannel = localStorage.getItem('activeChannelId_' + savedWs);
          if (savedChannel) setActiveChannelId(savedChannel);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    setLoading(false);
  }, []);

  // ─── Auto-select workspace when user logs in ──────────
  useEffect(() => {
    if (currentUser && !activeWorkspaceId) {
      const userWs = workspaces.filter((ws) =>
        ws.members.some((m) => m.userId === currentUser.id)
      );
      if (userWs.length > 0) {
        setActiveWorkspaceId(userWs[0].id);
        const general = userWs[0].channels.find(
          (c) => c.isDefault && c.type === 'text'
        );
        if (general) setActiveChannelId(general.id);
      }
    }
  }, [currentUser, workspaces, activeWorkspaceId]);

  // ─── Persist workspace selection ───────────────────────
  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem('activeWorkspaceId', activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (activeWorkspaceId && activeChannelId) {
      localStorage.setItem('activeChannelId_' + activeWorkspaceId, activeChannelId);
    }
  }, [activeWorkspaceId, activeChannelId]);

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

  const canManageAIReview = canManageAIWorkflow(workspaceRole);

  const channelMessages = useMemo(() => {
    if (!activeChannelId) return [];
    return messages[activeChannelId] || [];
  }, [messages, activeChannelId]);

  const teamMessagesKey = activeTeamId ? 'team-chat-' + activeTeamId : null;

  const activeTeamMessages = useMemo(() => {
    if (!teamMessagesKey) return [];
    return messages[teamMessagesKey] || [];
  }, [messages, teamMessagesKey]);

  const userInvitations = useMemo(() => {
    if (!currentUser) return [];
    return invitations.filter((inv) => inv.status === 'PENDING');
  }, [invitations, currentUser]);

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
    return activeWorkspace.members;
  }, [activeWorkspace]);

  const workspaceTeams = useMemo(() => {
    if (!activeWorkspace) return [];
    return activeWorkspace.teams || [];
  }, [activeWorkspace]);

  const canAccessTeam = useCallback((team) => {
    if (!team || !currentUser) return false;
    if (['OWNER', 'VICE_ADMIN', 'MANAGER'].includes(workspaceRole)) return true;
    return (team.memberIds || []).includes(currentUser.id);
  }, [currentUser, workspaceRole]);

  // ─── Toast Actions ─────────────────────────────────────
  const showToast = useCallback((type, message) => {
    const id = 'toast-' + generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
    // Auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
    return id;
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // ─── Activity Actions ──────────────────────────────────
  const addActivity = useCallback((type, message, metadata = {}) => {
    const activity = {
      id: 'act-' + generateId(),
      type,
      message,
      userId: currentUser?.id || null,
      userName: currentUser?.name || 'System',
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    setActivityFeed((prev) => [activity, ...prev].slice(0, 50)); // Keep last 50
    return activity;
  }, [currentUser]);

  const addNotification = useCallback((type, title, message, metadata = {}) => {
    const targetWorkspaceId = metadata.workspaceId || activeWorkspaceId;
    if (metadata.respectWorkspaceMute !== false && workspaceNotificationSettings[targetWorkspaceId] === false) {
      return null;
    }
    const notification = {
      id: 'ntf-' + generateId(),
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
      workspaceId: targetWorkspaceId,
      ...metadata,
    };
    setAiNotifications((prev) => [notification, ...prev].slice(0, 50));
    return notification;
  }, [activeWorkspaceId, workspaceNotificationSettings]);

  const workspaceNotificationsEnabled = workspaceNotificationSettings[activeWorkspaceId] !== false;

  const setWorkspaceNotificationsEnabled = useCallback((workspaceId, enabled) => {
    if (!workspaceId) return;
    setWorkspaceNotificationSettings((prev) => ({
      ...prev,
      [workspaceId]: Boolean(enabled),
    }));
  }, []);

  const toggleWorkspaceNotifications = useCallback((workspaceId = activeWorkspaceId) => {
    if (!workspaceId) return;
    setWorkspaceNotificationSettings((prev) => ({
      ...prev,
      [workspaceId]: prev[workspaceId] === false,
    }));
  }, [activeWorkspaceId]);

  const markNotificationRead = useCallback((notificationId) => {
    setAiNotifications((prev) => prev.map((item) =>
      item.id === notificationId ? { ...item, isRead: true, unread: false } : item
    ));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setAiNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, unread: false })));
  }, []);

  // ─── Onboarding Actions ────────────────────────────────
  const initOnboarding = useCallback(() => {
    setOnboarding({
      showChecklist: true,
      steps: {
        invited: false,
        teamCreated: false,
        meetingUploaded: false,
        tasksReviewed: false,
        analyticsViewed: false,
      },
    });
  }, []);

  const completeOnboardingStep = useCallback((step) => {
    setOnboarding((prev) => ({
      ...prev,
      steps: { ...prev.steps, [step]: true },
    }));
  }, []);

  const dismissOnboarding = useCallback(() => {
    setOnboarding((prev) => ({ ...prev, showChecklist: false }));
  }, []);

  // ─── Auth Actions ──────────────────────────────────────
  const login = useCallback(async (email, password) => {
    await new Promise((r) => setTimeout(r, 800));

    const { mockUsers } = await import('@/lib/workspaceData');
    const user = mockUsers.find((u) => u.email === email);

    if (!user) throw new Error('Email không tồn tại');
    if (password !== '123456') throw new Error('Mật khẩu không đúng');

    // Return account-only object (NO global role)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };
  }, []);

  const register = useCallback(async (name, email, password) => {
    await new Promise((r) => setTimeout(r, 800));

    if (!name || !email || !password) throw new Error('Vui lòng điền đầy đủ thông tin');

    return {
      id: 'user-' + generateId(),
      name,
      email,
      avatar: null,
      createdAt: new Date().toISOString(),
    };
  }, []);

  const setUser = useCallback((user) => {
    setCurrentUser(user);
    if (user) {
      // Mock-only account profile persistence. Real auth should use secure server/session storage.
      localStorage.setItem('meetingAppUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('meetingAppUser');
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setActiveWorkspaceId(null);
    setActiveChannelId(null);
    setActiveTeamId(null);
    setActiveView(null);
    localStorage.removeItem('meetingAppUser');
    localStorage.removeItem('activeWorkspaceId');
  }, []);

  // ─── Workspace Actions ─────────────────────────────────
  const createWorkspace = useCallback((name) => {
    if (!currentUser) return null;

    const newWorkspace = createDefaultWorkspaceStructure(name, currentUser.id);

    setWorkspaces((prev) => [...prev, newWorkspace]);
    setActiveWorkspaceId(newWorkspace.id);
    setActiveTeamId(null);

    // Auto-select first text channel
    const firstText = newWorkspace.channels.find((c) => c.type === 'text');
    setActiveChannelId(firstText?.id || null);
    setActiveView('home');

    // Init messages for default channels
    const welcomeMsg = {
      id: 'msg-' + generateId(),
      channelId: firstText?.id,
      workspaceId: newWorkspace.id,
      userId: currentUser.id,
      content: '🎉 Welcome to **' + newWorkspace.name + '**! Start by inviting your team and setting up your workspace.',
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    setMessages((prev) => ({
      ...prev,
      [firstText?.id]: [welcomeMsg],
    }));

    // Initialize activity feed
    const initialActivities = createInitialActivity(newWorkspace.id, currentUser.name);
    setActivityFeed(initialActivities);

    // Show onboarding checklist for new workspaces
    initOnboarding();

    showToast('success', 'Workspace "' + newWorkspace.name + '" created successfully!');

    return newWorkspace;
  }, [currentUser, initOnboarding, showToast]);

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
    // Track onboarding
    if (view === 'analytics') {
      completeOnboardingStep('analyticsViewed');
    }
  }, [completeOnboardingStep]);

  const selectTeamChat = useCallback((teamId) => {
    setActiveTeamId(teamId);
    setActiveView('team-chat');
    setActiveChannelId(null);
  }, []);

  // ─── Channel Actions ───────────────────────────────────
  const createChannel = useCallback((name, type, description) => {
    if (!activeWorkspace || !currentUser) return null;

    const channelId = 'ch-' + generateId();
    const newChannel = {
      id: channelId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      type,
      description: description || '',
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    if (type === 'voice') {
      Object.assign(newChannel, normalizeVoiceChannel({
        ...newChannel,
        name: name.trim() || 'New Voice',
        scope: 'WORKSPACE',
      }));
    }

    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id === activeWorkspace.id) {
          return { ...ws, channels: [...ws.channels, newChannel] };
        }
        return ws;
      })
    );

    setMessages((prev) => ({ ...prev, [channelId]: [] }));
    setActiveChannelId(channelId);
    setActiveTeamId(null);
    setActiveView(null);

    addActivity('channel_created', 'Channel #' + newChannel.name + ' created');

    return newChannel;
  }, [activeWorkspace, currentUser, addActivity]);

  const deleteChannel = useCallback((channelId) => {
    if (!activeWorkspace) return;
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id === activeWorkspace.id) {
          return {
            ...ws,
            channels: ws.channels.filter((c) => c.id !== channelId),
          };
        }
        return ws;
      })
    );

    if (activeChannelId === channelId) {
      const remaining = activeWorkspace.channels.filter((c) => c.id !== channelId);
      const fallback = remaining.find((c) => c.type === 'text');
      setActiveChannelId(fallback?.id || null);
      setActiveView(null);
    }
  }, [activeWorkspace, activeChannelId]);

  // ─── Message Actions ───────────────────────────────────
  const sendMessage = useCallback((channelId, content, attachments) => {
    if (!currentUser || !content?.trim()) return;
    const channel = activeWorkspace?.channels?.find((item) => item.id === channelId);

    const newMsg = {
      id: 'msg-' + generateId(),
      channelId,
      workspaceId: activeWorkspaceId,
      userId: currentUser.id,
      content: content.trim(),
      attachments: attachments || [],
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    setMessages((prev) => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), newMsg],
    }));
    addNotification('CHAT_MESSAGE', `New message in #${channel?.name || 'workspace chat'}`, `${currentUser.name}: ${content.trim()}`, {
      channelId,
      messageId: newMsg.id,
      senderId: currentUser.id,
      workspaceId: activeWorkspaceId,
    });
  }, [currentUser, activeWorkspaceId, activeWorkspace, addNotification]);

  const sendTeamMessage = useCallback((teamId, content, attachments) => {
    if (!currentUser || !teamId || !content?.trim()) return;

    const newMsg = {
      id: 'msg-' + generateId(),
      teamId,
      workspaceId: activeWorkspaceId,
      userId: currentUser.id,
      content: content.trim(),
      attachments: attachments || [],
      createdAt: new Date().toISOString(),
      updatedAt: null,
      scope: 'TEAM',
    };

    const key = 'team-chat-' + teamId;
    setMessages((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newMsg],
    }));
    addActivity('team_message_created', 'Team message created', { teamId });
    addNotification('TEAM_MESSAGE', 'New team message', `${currentUser.name}: ${content.trim()}`, {
      teamId,
      messageId: newMsg.id,
      senderId: currentUser.id,
      workspaceId: activeWorkspaceId,
    });
  }, [currentUser, activeWorkspaceId, addActivity, addNotification]);

  // ─── Invitation Actions ────────────────────────────────
  const sendInvitation = useCallback((workspaceId, inviteeEmail, role, teamIds = []) => {
    if (!currentUser) return;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

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
    return newInv;
  }, [currentUser, workspaces, addActivity, showToast]);

  const acceptInvitation = useCallback((invitationId) => {
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) return;

    setInvitations((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: 'ACCEPTED' } : i))
    );

    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id === inv.workspaceId) {
          const alreadyMember = ws.members.some((m) => m.userId === currentUser.id);
          const memberIdsToAssign = inv.teamIds || [];
          return {
            ...ws,
            members: alreadyMember
              ? ws.members
              : [
                  ...ws.members,
                  {
                    userId: currentUser.id,
                    role: inv.role || 'EMPLOYEE',
                    joinedAt: new Date().toISOString(),
                    nickname: null,
                  },
                ],
            teams: (ws.teams || []).map((team) =>
              memberIdsToAssign.includes(team.id)
                ? { ...team, memberIds: Array.from(new Set([...(team.memberIds || []), currentUser.id])) }
                : team
            ),
          };
        }
        return ws;
      })
    );

    setActiveWorkspaceId(inv.workspaceId);
    const ws = workspaces.find((w) => w.id === inv.workspaceId);
    if (ws) {
      const general = ws.channels.find((c) => c.isDefault && c.type === 'text') || ws.channels[0];
      setActiveChannelId(general?.id || null);
      setActiveTeamId(null);
      setActiveView('home');
    }
  }, [invitations, currentUser, workspaces]);

  const declineInvitation = useCallback((invitationId) => {
    setInvitations((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: 'DECLINED' } : i))
    );
  }, []);

  // ─── Task Actions (shared between AI and Kanban) ────────
  const addWorkspaceTasks = useCallback((newTasks) => {
    if (!newTasks || newTasks.length === 0) return;
    const tasksWithMeta = newTasks.map((t) => ({
      id: 'task-' + generateId(),
      meetingId: t.meetingId || t.sourceMeetingId || null,
      sourceMeetingId: t.sourceMeetingId || t.meetingId || null,
      teamId: t.teamId || null,
      departmentId: activeWorkspaceId,
      title: t.title,
      description: t.description || '',
      status: 'TODO',
      priority: t.priority || 'MEDIUM',
      assigneeId: t.assigneeId || t.assignee?.id || t.assignee || null,
      deadline: t.deadline || null,
      createdBy: currentUser?.id,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      progress: 0,
    }));
    setWorkspaceTasks((prev) => [...tasksWithMeta, ...prev]);

    addActivity('tasks_created', tasksWithMeta.length + ' tasks created from meeting');
    completeOnboardingStep('tasksReviewed');

    return tasksWithMeta;
  }, [currentUser, activeWorkspaceId, addActivity, completeOnboardingStep]);

  const moveWorkspaceTask = useCallback((taskId, newStatus) => {
    let taskTitle = '';
    setWorkspaceTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        taskTitle = t.title;
        return { ...t, status: newStatus, updatedAt: new Date().toISOString() };
      })
    );
    addActivity('task_status_changed', 'Task status changed to ' + newStatus, { taskId, taskTitle });
  }, [addActivity]);

  const createMeeting = useCallback((meetingData) => {
    if (!canManageAIReview) {
      showToast('error', 'Only managers can upload meetings for AI review.');
      return null;
    }
    if (!activeWorkspaceId || !currentUser || !meetingData?.title?.trim()) return null;

    const meeting = {
      id: 'meeting-' + generateId(),
      workspaceId: activeWorkspaceId,
      teamId: meetingData.teamId || null,
      title: meetingData.title.trim(),
      type: meetingData.type || 'TRANSCRIPT',
      fileName: meetingData.fileName || null,
      audioFile: meetingData.audioFile || null,
      storageKey: meetingData.storageKey || null,
      transcript: meetingData.transcript || '',
      transcriptText: meetingData.transcriptText || meetingData.transcript || '',
      status: 'UPLOADED',
      participantIds: meetingData.participantIds || [],
      aiSummary: '',
      summary: '',
      keyDecisions: [],
      actionItems: [],
      risks: [],
      suggestedTasks: [],
      generatedTaskIds: [],
      processingJobId: null,
      processingError: null,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkspaceMeetings((prev) => [meeting, ...prev]);
    addActivity('meeting_created', 'Created meeting "' + meeting.title + '"', { meetingId: meeting.id });
    addActivity('meeting_uploaded', 'Uploaded ' + (meeting.fileName || 'transcript') + ' for "' + meeting.title + '"', { meetingId: meeting.id });
    completeOnboardingStep('meetingUploaded');
    return meeting;
  }, [activeWorkspaceId, currentUser, canManageAIReview, addActivity, completeOnboardingStep, showToast]);

  const uploadMeetingMock = useCallback(async (meetingId, file) => {
    if (!file) return null;
    const uploaded = await serviceUploadMeetingFile(file, { workspaceId: activeWorkspaceId, meetingId });
    setWorkspaceMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              fileName: uploaded.fileName,
              audioFile: {
                name: uploaded.fileName,
                type: uploaded.fileType,
                size: uploaded.fileSize,
              },
              storageKey: uploaded.storageKey,
              updatedAt: new Date().toISOString(),
            }
          : meeting
      )
    );
    return uploaded;
  }, [activeWorkspaceId]);

  const processMeetingWithAI = useCallback(async (meetingOrId) => {
    if (!canManageAIReview) {
      showToast('error', 'Only managers can run AI meeting analysis.');
      return null;
    }
    const meeting = typeof meetingOrId === 'string'
      ? workspaceMeetings.find((item) => item.id === meetingOrId)
      : meetingOrId;
    if (!meeting) return null;
    const meetingId = meeting.id;

    setWorkspaceMeetings((prev) =>
      prev.map((item) => item.id === meetingId ? { ...item, status: 'PROCESSING', updatedAt: new Date().toISOString() } : item)
    );

    const team = activeWorkspace?.teams?.find((item) => item.id === meeting.teamId);
    const analysis = await serviceAnalyzeMeeting(meeting, {
      workspace: activeWorkspace,
      team,
      members: workspaceMembers,
      transcript: meeting.transcriptText || meeting.transcript,
    });

    setWorkspaceMeetings((prev) =>
      prev.map((item) =>
        item.id === meetingId
          ? {
              ...item,
              ...analysis,
              aiSummary: analysis.summary,
              processingJobId: analysis.processingJobId || item.processingJobId,
              processingError: null,
              status: 'AI_REVIEW_READY',
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    addActivity('ai_summary_generated', 'AI generated summary for "' + meeting.title + '"', { meetingId });
    addActivity('ai_tasks_suggested', 'AI suggested ' + analysis.suggestedTasks.length + ' tasks from "' + meeting.title + '"', { meetingId });
    addNotification('AI_PROCESSED', 'AI processed meeting completed', '"' + meeting.title + '" is ready for manager review.', { meetingId });
    showToast('success', 'AI summary and task suggestions are ready.');
    return analysis;
  }, [workspaceMeetings, activeWorkspace, workspaceMembers, canManageAIReview, addActivity, addNotification, showToast]);

  const updateMeetingSuggestion = useCallback((meetingId, suggestionId, patch) => {
    setWorkspaceMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              suggestedTasks: (meeting.suggestedTasks || []).map((task) =>
                task.id === suggestionId ? normalizeSuggestion({ ...task, ...patch }) : task
              ),
              updatedAt: new Date().toISOString(),
            }
          : meeting
      )
    );
  }, []);

  const updateSuggestedTask = updateMeetingSuggestion;

  const toggleSuggestedTaskSelection = useCallback((meetingId, suggestionId) => {
    setWorkspaceMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              suggestedTasks: (meeting.suggestedTasks || []).map((task) =>
                task.id === suggestionId ? { ...task, approved: !task.approved, selected: !task.approved } : task
              ),
              updatedAt: new Date().toISOString(),
            }
          : meeting
      )
    );
  }, []);

  const removeMeetingSuggestion = useCallback((meetingId, suggestionId) => {
    setWorkspaceMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              suggestedTasks: (meeting.suggestedTasks || []).filter((task) => task.id !== suggestionId),
              updatedAt: new Date().toISOString(),
            }
          : meeting
      )
    );
  }, []);

  const createTasksFromMeeting = useCallback((meetingId, selectedSuggestedTaskIds = null) => {
    if (!canManageAIReview) {
      showToast('error', 'Only managers can approve AI task suggestions.');
      return [];
    }
    const meeting = workspaceMeetings.find((item) => item.id === meetingId);
    if (!meeting) return [];

    const approvedSuggestions = (meeting.suggestedTasks || []).filter((task) =>
      selectedSuggestedTaskIds ? selectedSuggestedTaskIds.includes(task.id) : (task.selected || task.approved)
    );
    if (approvedSuggestions.length === 0) {
      showToast('info', 'Select at least one AI task suggestion.');
      return [];
    }

    const createdTasks = buildTasksFromSuggestions(meetingId, approvedSuggestions, {
      workspaceId: meeting.workspaceId,
      teamId: meeting.teamId,
      createdBy: currentUser?.id,
    });

    setWorkspaceTasks((prev) => [...createdTasks, ...prev]);
    setWorkspaceMeetings((prev) =>
      prev.map((item) =>
        item.id === meetingId
          ? {
              ...item,
              status: 'TASKS_GENERATED',
              generatedTaskIds: Array.from(new Set([...(item.generatedTaskIds || []), ...createdTasks.map((task) => task.id)])),
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    if (meeting.teamId) {
      const key = 'team-chat-' + meeting.teamId;
      const systemMsg = {
        id: 'msg-' + generateId(),
        teamId: meeting.teamId,
        workspaceId: meeting.workspaceId,
        userId: 'system-ai',
        content: 'AI created ' + createdTasks.length + ' tasks from meeting "' + meeting.title + '".',
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: null,
        scope: 'TEAM',
        system: true,
      };
      setMessages((prev) => ({ ...prev, [key]: [...(prev[key] || []), systemMsg] }));
    }

    addActivity('manager_approved_tasks', 'Manager approved ' + createdTasks.length + ' AI tasks from "' + meeting.title + '"', { meetingId });
    addNotification('AI_TASKS_APPROVED', 'Manager approved AI tasks', createdTasks.length + ' tasks were created from "' + meeting.title + '".', { meetingId });
    createdTasks.forEach((task) => {
      if (task.assigneeId) {
        addNotification('TASK_ASSIGNED', 'New task assigned', '"' + task.title + '" was assigned from meeting "' + meeting.title + '".', { taskId: task.id, userId: task.assigneeId });
      }
    });
    completeOnboardingStep('tasksReviewed');
    showToast('success', createdTasks.length + ' tasks created from AI suggestions.');
    return createdTasks;
  }, [workspaceMeetings, currentUser, canManageAIReview, addActivity, addNotification, completeOnboardingStep, showToast]);

  const createTasksFromSuggestions = createTasksFromMeeting;

  const getTasksByMeeting = useCallback((meetingId) => {
    return serviceGetTasksByMeeting(workspaceTasks, meetingId);
  }, [workspaceTasks]);

  const analyzeMeetingWithAI = processMeetingWithAI;

  // ─── Member Actions ────────────────────────────────────
  const updateMemberRole = useCallback((workspaceId, userId, newRole) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          members: ws.members.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
        };
      })
    );
    addActivity('role_updated', 'Member role updated to ' + newRole);
  }, [addActivity]);

  const removeMember = useCallback((workspaceId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          members: ws.members.filter((m) => m.userId !== userId),
          teams: (ws.teams || []).map((team) => ({
            ...team,
            memberIds: (team.memberIds || []).filter((id) => id !== userId),
            managerId: team.managerId === userId ? null : team.managerId,
          })),
        };
      })
    );
  }, []);

  // ─── Team CRUD Actions ─────────────────────────────────
  const createTeam = useCallback((workspaceId, teamData) => {
    if (!teamData.name?.trim()) return null;

    // Find the workspace
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (!ws) return null;

    const memberIds = Array.from(new Set([
      ...(teamData.memberIds || []),
      currentUser?.id,
      teamData.managerId,
    ].filter(Boolean)));

    const newTeam = {
      id: workspaceId + '-team-' + generateId(),
      workspaceId,
      name: teamData.name.trim(),
      description: teamData.description || '',
      color: teamData.color || '#5865F2',
      managerId: teamData.managerId || currentUser?.id || null,
      memberIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== workspaceId) return w;
        return {
          ...w,
          teams: [...(w.teams || []), newTeam],
        };
      })
    );

    setMessages((prev) => ({ ...prev, ['team-chat-' + newTeam.id]: [] }));
    setActiveTeamId(newTeam.id);
    setActiveChannelId(null);
    setActiveView('team-chat');

    addActivity('team_created', 'Team "' + newTeam.name + '" created');
    completeOnboardingStep('teamCreated');
    showToast('success', 'Team "' + newTeam.name + '" created!');

    return newTeam;
  }, [workspaces, currentUser, addActivity, completeOnboardingStep, showToast]);

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
    showToast('success', 'Team updated!');
  }, [showToast]);

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
    showToast('info', 'Team deleted.');
  }, [showToast]);

  const addMemberToTeam = useCallback((workspaceId, teamId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).map((t) =>
            t.id === teamId && !t.memberIds.includes(userId)
              ? { ...t, memberIds: [...t.memberIds, userId], updatedAt: new Date().toISOString() }
              : t
          ),
        };
      })
    );
    addActivity('member_added_to_team', 'Member added to team', { teamId, memberUserId: userId });
  }, [addActivity]);

  const removeMemberFromTeam = useCallback((workspaceId, teamId, userId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).map((t) =>
            t.id === teamId
              ? { ...t, memberIds: t.memberIds.filter((id) => id !== userId), updatedAt: new Date().toISOString() }
              : t
          ),
        };
      })
    );
  }, []);

  const assignTeamManager = useCallback((workspaceId, teamId, managerId) => {
    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          teams: (ws.teams || []).map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  managerId,
                  memberIds: Array.from(new Set([...(t.memberIds || []), managerId].filter(Boolean))),
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        };
      })
    );
    showToast('success', 'Team manager updated!');
  }, [showToast]);

  // ─── Role Management ───────────────────────────────────
  const createCustomRole = useCallback((workspaceId, roleData) => {
    const newRole = {
      id: 'role-' + generateId(),
      name: roleData.name,
      description: roleData.description || '',
      permissions: roleData.permissions || [],
      color: roleData.color || '#999999',
      isSystem: false,
    };

    setWorkspaces((prev) =>
      prev.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return {
          ...ws,
          customRoles: [...(ws.customRoles || []), newRole],
        };
      })
    );

    return newRole;
  }, []);

  // ─── Permission Check ──────────────────────────────────
  const can = useCallback(
    (permission) => {
      return hasWorkspacePermission(activeWorkspace, currentUser?.id, permission);
    },
    [activeWorkspace, currentUser]
  );

  const canInWorkspace = useCallback(
    (workspaceId, permission) => {
      const ws = workspaces.find((w) => w.id === workspaceId);
      return hasWorkspacePermission(ws, currentUser?.id, permission);
    },
    [workspaces, currentUser]
  );

  const getMemberProfile = useCallback((userId) => {
    return workspaceMembers.find((member) => member.userId === userId) || { userId, role: 'EMPLOYEE' };
  }, [workspaceMembers]);

  const canAccessVoice = useCallback((channel) => {
    return canAccessVoiceChannel(channel, currentUser, activeWorkspace, workspaceTeams);
  }, [currentUser, activeWorkspace, workspaceTeams]);

  const canRecordVoice = useCallback((channel) => {
    const permissions = currentUser ? getUserWorkspacePermissions(activeWorkspace, currentUser.id) : [];
    return canRecordVoiceChannel(channel, currentUser, activeWorkspace, workspaceTeams, permissions);
  }, [currentUser, activeWorkspace, workspaceTeams]);

  const joinVoiceChannel = useCallback((channelId, options = {}) => {
    const channel = voiceChannels.find((item) => item.id === channelId);
    if (!channel || !currentUser) return { ok: false, reason: 'NOT_FOUND' };
    if (!canAccessVoice(channel)) {
      showToast('error', 'You do not have access to this voice channel.');
      return { ok: false, reason: 'NO_ACCESS' };
    }
    if (activeVoiceRecordings[channelId] && !options.confirmed) {
      return { ok: false, reason: 'RECORDING_CONSENT_REQUIRED', needsConsent: true };
    }
    const now = new Date().toISOString();
    const member = getMemberProfile(currentUser.id);
    setVoiceParticipants((prev) => {
      const existing = prev[channelId] || [];
      if (existing.some((participant) => participant.userId === currentUser.id)) return prev;
      return {
        ...prev,
        [channelId]: [
          ...existing,
          {
            userId: currentUser.id,
            name: currentUser.name,
            joinedAt: now,
            status: 'JOINED',
            isMuted: false,
            isSpeaking: false,
            audioLevel: 0,
            isRecording: false,
            role: member.role || workspaceRole || 'EMPLOYEE',
          },
        ],
      };
    });
    if (activeVoiceRecordings[channelId]) {
      setActiveVoiceRecordings((prev) => ({
        ...prev,
        [channelId]: {
          ...prev[channelId],
          participantIds: Array.from(new Set([...(prev[channelId]?.participantIds || []), currentUser.id])),
        },
      }));
    }
    setActiveVoiceChannelId(channelId);
    return { ok: true };
  }, [voiceChannels, currentUser, canAccessVoice, showToast, activeVoiceRecordings, getMemberProfile, workspaceRole]);

  const updateVoiceParticipantState = useCallback((channelId, userId, updates) => {
    setVoiceParticipants((prev) => {
      const participants = prev[channelId];
      if (!participants) return prev;
      let changed = false;
      const next = participants.map((participant) => {
        if (participant.userId !== userId) return participant;
        let dirty = false;
        for (const key of Object.keys(updates)) {
          if (key === 'audioLevel') continue; // realtime, skip to avoid spam
          if (participant[key] !== updates[key]) {
            dirty = true;
            break;
          }
        }
        if (!dirty) return participant;
        changed = true;
        return { ...participant, ...updates };
      });
      if (!changed) return prev;
      return { ...prev, [channelId]: next };
    });
  }, []);

  const syncVoiceParticipant = useCallback((channelId, participantData = {}) => {
    if (!channelId || !participantData.userId) return;
    setVoiceParticipants((prev) => {
      const participants = prev[channelId] || [];
      const index = participants.findIndex(
        (p) => p.userId === participantData.userId
      );

      // New participant — add
      if (index === -1) {
        return {
          ...prev,
          [channelId]: [
            ...participants,
            {
              ...participantData,
              joinedAt: participantData.joinedAt || new Date().toISOString(),
            },
          ],
        };
      }

      // Existing participant — only setState if something meaningful changed
      const current = participants[index];
      const keys = Object.keys(participantData);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        // Skip audioLevel — it's realtime and changes every frame;
        // it belongs to local state / VoiceConnectionContext, not global context.
        if (key === 'audioLevel') continue;
        if (current[key] !== participantData[key]) {
          const nextParticipants = [...participants];
          nextParticipants[index] = { ...current, ...participantData };
          return { ...prev, [channelId]: nextParticipants };
        }
      }

      // Nothing changed — bail out
      return prev;
    });
  }, []);

  const removeVoiceParticipant = useCallback((channelId, userId) => {
    setVoiceParticipants((prev) => ({
      ...prev,
      [channelId]: (prev[channelId] || []).filter((participant) => participant.userId !== userId),
    }));
  }, []);

  const setVoiceChannelParticipants = useCallback((channelId, participants = []) => {
    setVoiceParticipants((prev) => ({
      ...prev,
      [channelId]: participants,
    }));
  }, []);

  const finishVoiceRecording = useCallback(async (channelId, reason = 'MANUAL') => {
    const active = activeVoiceRecordings[channelId];
    if (!active) return null;
    const recorder = mediaRecorderRefs.current[channelId];
    const stream = mediaStreamRefs.current[channelId];

    const stopRecorder = () => new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    await stopRecorder();
    mediaCleanupRefs.current[channelId]?.();
    stream?.getTracks?.().forEach((track) => track.stop());
    const chunks = mediaChunkRefs.current[channelId] || [];
    const type = chunks[0]?.type || active.mimeType || 'audio/webm';
    const blob = chunks.length > 0 ? new Blob(chunks, { type }) : new Blob([], { type });
    const objectUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
    const channel = voiceChannels.find((item) => item.id === channelId);
    const now = new Date().toISOString();
    const dateLabel = now.slice(0, 10);
    const fileName = sanitizeVoiceFileName(`${channel?.name || 'voice'}-${dateLabel}.webm`);
    const recordData = {
      workspaceId: activeWorkspaceId,
      channelId,
      teamId: channel?.teamId || null,
      title: `${channel?.name || 'Voice'} Recording - ${dateLabel}`,
      recordedBy: active.startedBy,
      participantIds: active.participantIds || [],
      durationSeconds: active.durationSeconds || Math.max(1, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 1000)),
      sizeBytes: blob.size,
      format: blob.type || 'audio/webm',
      fileName,
      objectUrl,
      status: 'READY',
      aiStatus: blob.size > MAX_VOICE_RECORDING_SIZE_BYTES ? 'FAILED' : 'NOT_SENT',
      autoStopped: reason === 'AUTO_EMPTY_CHANNEL',
      createdAt: now,
      updatedAt: now,
    };
    const record = await serviceCreateVoiceRecord(recordData);
    setVoiceRecords((prev) => [record, ...prev]);
    setActiveVoiceRecordings((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    setVoiceParticipants((prev) => ({
      ...prev,
      [channelId]: (prev[channelId] || []).map((participant) => ({ ...participant, isRecording: false })),
    }));
    delete mediaRecorderRefs.current[channelId];
    delete mediaStreamRefs.current[channelId];
    delete mediaChunkRefs.current[channelId];
    delete mediaCleanupRefs.current[channelId];
    addActivity(
      'voice_recording_saved',
      reason === 'AUTO_EMPTY_CHANNEL'
        ? 'Recording automatically stopped because everyone left the voice channel.'
        : `Voice recording saved for "${channel?.name || 'Voice'}".`,
      { channelId, voiceRecordId: record.id }
    );
    showToast('success', 'Voice recording is ready.');
    return record;
  }, [activeVoiceRecordings, activeWorkspaceId, voiceChannels, addActivity, showToast]);

  const leaveVoiceChannel = useCallback(async (channelId) => {
    const currentActive = activeVoiceRecordings[channelId];
    const remaining = (voiceParticipants[channelId] || []).filter((participant) => participant.userId !== currentUser?.id);
    setVoiceParticipants((prev) => {
      return { ...prev, [channelId]: remaining };
    });
    if (currentActive && remaining.length === 0) {
      await finishVoiceRecording(channelId, 'AUTO_EMPTY_CHANNEL');
    } else if (currentActive?.startedBy === currentUser?.id) {
      showToast('info', 'The recorder left. Recording will stop automatically when the voice channel becomes empty.');
    }
    if (activeVoiceChannelId === channelId) setActiveVoiceChannelId(null);
  }, [activeVoiceRecordings, activeVoiceChannelId, voiceParticipants, currentUser, finishVoiceRecording, showToast]);

  const getCurrentUserVoiceChannel = useCallback(() => {
    if (!currentUser) return null;
    return Object.entries(voiceParticipants).find(([, participants]) =>
      participants.some((participant) => participant.userId === currentUser.id)
    )?.[0] || null;
  }, [currentUser, voiceParticipants]);

  const isCurrentUserInVoice = useCallback((channelId) => {
    if (!currentUser) return false;
    return (voiceParticipants[channelId] || []).some((participant) => participant.userId === currentUser.id);
  }, [currentUser, voiceParticipants]);

  const removeUserFromAllVoiceChannels = useCallback(async (userId) => {
    setVoiceParticipants((prev) => {
      const next = {};
      Object.entries(prev).forEach(([channelId, participants]) => {
        next[channelId] = participants.filter((participant) => participant.userId !== userId);
      });
      return next;
    });
    if (userId === currentUser?.id) setActiveVoiceChannelId(null);
    return { ok: true };
  }, [currentUser]);

  const switchVoiceChannel = useCallback(async (targetChannelId, options = {}) => {
    const currentChannelId = getCurrentUserVoiceChannel();
    if (currentChannelId === targetChannelId) return { ok: true };

    if (currentChannelId && activeVoiceRecordings[currentChannelId] && !options.confirmedStopRecording) {
      return { ok: false, reason: 'STOP_RECORDING_CONFIRM_REQUIRED', needsStopConfirm: true };
    }

    if (targetChannelId && activeVoiceRecordings[targetChannelId] && !options.confirmedTargetRecording) {
      return { ok: false, reason: 'RECORDING_CONSENT_REQUIRED', needsConsent: true };
    }

    if (currentChannelId) await leaveVoiceChannel(currentChannelId);
    return joinVoiceChannel(targetChannelId, { confirmed: true });
  }, [activeVoiceRecordings, getCurrentUserVoiceChannel, joinVoiceChannel, leaveVoiceChannel]);

  const startVoiceRecording = useCallback(async (channelId, providedStream = null, options = {}) => {
    const channel = voiceChannels.find((item) => item.id === channelId);
    const participants = voiceParticipants[channelId] || [];
    if (!channel || !currentUser) return { ok: false };
    if (!participants.some((participant) => participant.userId === currentUser.id)) {
      showToast('error', 'Join the voice channel before recording.');
      return { ok: false, reason: 'NOT_JOINED' };
    }
    if (!canRecordVoice(channel)) {
      showToast('error', 'You do not have permission to record this voice channel.');
      return { ok: false, reason: 'NO_RECORD_PERMISSION' };
    }
    if (activeVoiceRecordings[channelId]) {
      showToast('error', 'This voice channel is already being recorded.');
      return { ok: false, reason: 'ALREADY_RECORDING' };
    }
    try {
      const settings = options.settings || {};
      const rawStream = providedStream?.getAudioTracks?.().some((track) => track.readyState === 'live')
        ? providedStream
        : await navigator.mediaDevices.getUserMedia(buildAudioConstraints(settings));
      const remoteStreamList = options.remoteStreams instanceof Map
        ? Array.from(options.remoteStreams.values())
        : Object.values(options.remoteStreams || {});
      const processed = options.recordingTestMode === 'RAW_LOCAL_MIC'
        ? createProcessedLocalRecordingStream({ localStream: rawStream, makeupGain: settings.localRecordingGain })
        : createProcessedRecordingStream({ localStream: rawStream, remoteStreams: remoteStreamList, settings });
      const stream = processed.stream;
      const recorderOptions = buildMediaRecorderOptions(settings);
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaChunkRefs.current[channelId] = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) mediaChunkRefs.current[channelId].push(event.data);
      };
      recorder.start(30000);
      mediaRecorderRefs.current[channelId] = recorder;
      mediaStreamRefs.current[channelId] = stream;
      mediaCleanupRefs.current[channelId] = () => {
        processed.cleanup?.();
        if (!providedStream) rawStream?.getTracks?.().forEach((track) => track.stop());
      };
      const now = new Date().toISOString();
      const participantIds = participants.map((participant) => participant.userId);
      setActiveVoiceRecordings((prev) => ({
        ...prev,
        [channelId]: {
          id: 'active-rec-' + generateId(),
          channelId,
          workspaceId: activeWorkspaceId,
          teamId: channel.teamId || null,
          startedBy: currentUser.id,
          startedAt: now,
          durationSeconds: 0,
          estimatedSizeBytes: 0,
          participantIds,
          status: 'RECORDING',
          mimeType: recorderOptions.mimeType || 'audio/webm',
        },
      }));
      setVoiceParticipants((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] || []).map((participant) =>
          participant.userId === currentUser.id ? { ...participant, isRecording: true } : participant
        ),
      }));
      showToast('info', `Recording started by ${currentUser.name}.`);
      return { ok: true };
    } catch (error) {
      showToast('error', error?.message || 'Unable to access microphone.');
      return { ok: false, reason: 'MICROPHONE_ERROR' };
    }
  }, [voiceChannels, voiceParticipants, currentUser, canRecordVoice, activeVoiceRecordings, activeWorkspaceId, showToast]);

  const stopVoiceRecording = useCallback((channelId, reason = 'MANUAL') => {
    return finishVoiceRecording(channelId, reason);
  }, [finishVoiceRecording]);

  const getActiveVoiceRecordingMetrics = useCallback((channelId) => {
    const recording = activeVoiceRecordings[channelId];
    if (!recording) return { durationSeconds: 0, estimatedSizeBytes: 0 };
    const chunks = mediaChunkRefs.current[channelId] || [];
    return {
      durationSeconds: Math.max(0, Math.round((Date.now() - new Date(recording.startedAt).getTime()) / 1000)),
      estimatedSizeBytes: chunks.reduce((total, chunk) => total + chunk.size, 0),
    };
  }, [activeVoiceRecordings]);

  const updateVoiceChannelPermissions = useCallback((channelId, updates) => {
    if (!['OWNER', 'VICE_ADMIN'].includes(workspaceRole)) {
      showToast('error', 'Only Owner or Vice Admin can manage voice permissions.');
      return null;
    }
    const now = new Date().toISOString();
    let updatedChannel = null;
    setWorkspaces((prev) => prev.map((ws) => {
      if (ws.id !== activeWorkspaceId) return ws;
      return {
        ...ws,
        channels: ws.channels.map((channel) => {
          if (channel.id !== channelId) return channel;
          updatedChannel = normalizeVoiceChannel({ ...channel, ...updates, updatedAt: now }, ws);
          return updatedChannel;
        }),
      };
    }));
    setVoiceParticipants((prev) => ({
      ...prev,
      [channelId]: (prev[channelId] || []).filter((participant) =>
        canAccessVoiceChannel(updatedChannel, { id: participant.userId }, activeWorkspace, workspaceTeams)
      ),
    }));
    showToast('success', 'Voice permissions updated.');
    return updatedChannel;
  }, [workspaceRole, activeWorkspaceId, activeWorkspace, workspaceTeams, showToast]);

  const addTeamToVoiceChannel = useCallback((channelId, teamId) => {
    const channel = voiceChannels.find((item) => item.id === channelId);
    return updateVoiceChannelPermissions(channelId, {
      allowedTeamIds: Array.from(new Set([...(channel?.allowedTeamIds || []), teamId])),
      isLocked: true,
    });
  }, [voiceChannels, updateVoiceChannelPermissions]);

  const removeTeamFromVoiceChannel = useCallback((channelId, teamId) => {
    const channel = voiceChannels.find((item) => item.id === channelId);
    return updateVoiceChannelPermissions(channelId, {
      allowedTeamIds: (channel?.allowedTeamIds || []).filter((id) => id !== teamId),
    });
  }, [voiceChannels, updateVoiceChannelPermissions]);

  const addUserToVoiceChannel = useCallback((channelId, userId) => {
    const channel = voiceChannels.find((item) => item.id === channelId);
    return updateVoiceChannelPermissions(channelId, {
      allowedUserIds: Array.from(new Set([...(channel?.allowedUserIds || []), userId])),
      isLocked: true,
    });
  }, [voiceChannels, updateVoiceChannelPermissions]);

  const removeUserFromVoiceChannel = useCallback((channelId, userId) => {
    const channel = voiceChannels.find((item) => item.id === channelId);
    return updateVoiceChannelPermissions(channelId, {
      allowedUserIds: (channel?.allowedUserIds || []).filter((id) => id !== userId),
    });
  }, [voiceChannels, updateVoiceChannelPermissions]);

  const toggleVoiceChannelLock = useCallback((channelId, isLocked) => {
    return updateVoiceChannelPermissions(channelId, { isLocked });
  }, [updateVoiceChannelPermissions]);

  const toggleVoiceRecordingPermission = useCallback((channelId, allowRecording) => {
    return updateVoiceChannelPermissions(channelId, { allowRecording });
  }, [updateVoiceChannelPermissions]);

  const deleteVoiceRecord = useCallback((recordId) => {
    const record = voiceRecords.find((item) => item.id === recordId);
    if (record?.objectUrl) URL.revokeObjectURL(record.objectUrl);
    setVoiceRecords((prev) => prev.map((item) =>
      item.id === recordId ? { ...item, status: 'DELETED', updatedAt: new Date().toISOString() } : item
    ));
    showToast('info', 'Voice record deleted.');
  }, [voiceRecords, showToast]);

  useEffect(() => {
    const streamRefs = mediaStreamRefs.current;
    const recordsRef = voiceRecordsRef;
    return () => {
      Object.values(streamRefs).forEach((stream) => {
        stream?.getTracks?.().forEach((track) => track.stop());
      });
      recordsRef.current.forEach((record) => {
        if (record.objectUrl) URL.revokeObjectURL(record.objectUrl);
      });
    };
  }, []);

  const sendVoiceRecordToAI = useCallback((recordId) => {
    const record = voiceRecords.find((item) => item.id === recordId);
    if (!record) return null;
    const channel = voiceChannels.find((item) => item.id === record.channelId);
    if (!canAccessVoice(channel)) {
      showToast('error', 'You do not have access to this voice record.');
      return null;
    }
    if (!canManageAIReview) {
      showToast('error', 'Only managers can send voice records to AI.');
      return null;
    }
    if (record.sizeBytes > MAX_VOICE_RECORDING_SIZE_BYTES) {
      showToast('error', 'Recording exceeds 400MB and cannot be sent to AI.');
      return null;
    }
    const now = new Date().toISOString();
    const meeting = {
      id: 'meeting-' + generateId(),
      workspaceId: record.workspaceId,
      teamId: record.teamId,
      title: record.title,
      type: 'AUDIO',
      sourceType: 'VOICE_RECORDING',
      sourceVoiceRecordId: record.id,
      fileName: record.fileName,
      fileSize: record.sizeBytes,
      storageKey: record.storageKey,
      audioObjectUrl: record.objectUrl,
      status: 'UPLOADED',
      participants: record.participantIds,
      participantIds: record.participantIds,
      generatedTaskIds: [],
      createdBy: currentUser?.id,
      createdAt: now,
      updatedAt: now,
    };
    setWorkspaceMeetings((prev) => [meeting, ...prev]);
    setVoiceRecords((prev) => prev.map((item) =>
      item.id === recordId
        ? { ...item, aiStatus: 'SENT_TO_AI', sourceMeetingId: meeting.id, updatedAt: now }
        : item
    ));
    addActivity('voice_record_sent_to_ai', `Voice recording sent to AI: "${record.title}"`, { recordId, meetingId: meeting.id });
    showToast('success', 'Voice record sent to AI Meeting Flow.');
    return meeting;
  }, [voiceRecords, voiceChannels, canAccessVoice, canManageAIReview, currentUser, addActivity, showToast]);

  // ─── Context Value ─────────────────────────────────────
  const value = useMemo(
    () => ({
      // Auth (account-only, no global role)
      currentUser,
      loading,
      login,
      register,
      setUser,
      logout,

      // Workspace
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      selectWorkspace,
      createWorkspace,
      activeTeamId,
      activeTeam,

      // Workspace-scoped role (ONLY source of truth)
      workspaceRole,
      workspaceRoleLabels,
      workspaceRoleColors,

      // Views
      activeView,
      selectView,
      activeChannelId,
      activeVoiceChannelId,
      activeChannel,
      selectChannel,
      selectTeamChat,

      // Channels
      textChannels,
      voiceChannels,
      createChannel,
      deleteChannel,

      // Voice presence, recording, permissions
      voiceParticipants,
      activeVoiceRecordings,
      voiceRecords,
      maxVoiceRecordingSizeBytes: MAX_VOICE_RECORDING_SIZE_BYTES,
      warningVoiceRecordingSizeBytes: WARNING_VOICE_RECORDING_SIZE_BYTES,
      canAccessVoice,
      canRecordVoice,
      updateVoiceParticipantState,
      syncVoiceParticipant,
      removeVoiceParticipant,
      setVoiceChannelParticipants,
      joinVoiceChannel,
      leaveVoiceChannel,
      switchVoiceChannel,
      getCurrentUserVoiceChannel,
      isCurrentUserInVoice,
      removeUserFromAllVoiceChannels,
      startVoiceRecording,
      stopVoiceRecording,
      getActiveVoiceRecordingMetrics,
      updateVoiceChannelPermissions,
      addTeamToVoiceChannel,
      removeTeamFromVoiceChannel,
      addUserToVoiceChannel,
      removeUserFromVoiceChannel,
      toggleVoiceChannelLock,
      toggleVoiceRecordingPermission,
      sendVoiceRecordToAI,
      deleteVoiceRecord,

      // Messages
      channelMessages,
      teamMessagesKey,
      activeTeamMessages,
      sendMessage,
      sendTeamMessage,

      // Tasks (shared between Kanban and AI)
      workspaceTasks,
      addWorkspaceTasks,
      moveWorkspaceTask,

      // Meetings / AI workflow
      workspaceMeetings,
      meetings: workspaceMeetings,
      setMeetings: setWorkspaceMeetings,
      createMeeting,
      uploadMeetingMock,
      analyzeMeetingWithAI,
      processMeetingWithAI,
      updateSuggestedTask,
      updateMeetingSuggestion,
      toggleSuggestedTaskSelection,
      removeMeetingSuggestion,
      createTasksFromSuggestions,
      createTasksFromMeeting,
      getTasksByMeeting,

      // Members
      workspaceMembers,
      updateMemberRole,
      removeMember,

      // Teams
      workspaceTeams,
      canAccessTeam,
      createTeam,
      updateTeam,
      deleteTeam,
      addMemberToTeam,
      removeMemberFromTeam,
      assignTeamManager,

      // Invitations
      invitations,
      userInvitations,
      sendInvitation,
      acceptInvitation,
      declineInvitation,
      showInvitations,
      setShowInvitations,

      // Roles
      createCustomRole,

      // Permissions (workspace-scoped)
      can,
      canInWorkspace,
      getAllPermissions: () => {
        if (!activeWorkspace || !currentUser) return [];
        if (workspaceRole === 'OWNER') return 'all';
        return getUserWorkspacePermissions(activeWorkspace, currentUser.id);
      },

      // Onboarding
      onboarding,
      initOnboarding,
      completeOnboardingStep,
      dismissOnboarding,

      // Activity
      activityFeed,
      addActivity,

      // Notifications
      aiNotifications,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      workspaceNotificationsEnabled,
      workspaceNotificationSettings,
      setWorkspaceNotificationsEnabled,
      toggleWorkspaceNotifications,

      // Toast
      toasts,
      showToast,
      dismissToast,

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
      currentUser, loading, workspaces, activeWorkspaceId, activeWorkspace,
      workspaceRole, activeView, activeChannelId, activeVoiceChannelId, activeChannel,
      activeTeamId, activeTeam, teamMessagesKey, activeTeamMessages,
      textChannels, voiceChannels, channelMessages,
      voiceParticipants, activeVoiceRecordings, voiceRecords,
      workspaceMembers, workspaceTeams, invitations, userInvitations,
      workspaceTasks, workspaceMeetings, aiNotifications, workspaceNotificationSettings, workspaceNotificationsEnabled, activityFeed, toasts, onboarding,
      showInvitations, showUserMenu, showCreateChannel,
      showCreateWorkspace, showCreateTeam, showInviteMember,
      showNotifications, notificationCount,
      login, register, setUser, logout, selectWorkspace, createWorkspace,
      selectView, selectChannel, selectTeamChat, createChannel, deleteChannel,
      sendMessage, sendTeamMessage,
      canAccessVoice, canRecordVoice, updateVoiceParticipantState, syncVoiceParticipant, removeVoiceParticipant, setVoiceChannelParticipants, joinVoiceChannel, leaveVoiceChannel,
      switchVoiceChannel, getCurrentUserVoiceChannel, isCurrentUserInVoice, removeUserFromAllVoiceChannels,
      startVoiceRecording, stopVoiceRecording, getActiveVoiceRecordingMetrics,
      updateVoiceChannelPermissions, addTeamToVoiceChannel, removeTeamFromVoiceChannel,
      addUserToVoiceChannel, removeUserFromVoiceChannel,
      toggleVoiceChannelLock, toggleVoiceRecordingPermission,
      sendVoiceRecordToAI, deleteVoiceRecord,
      updateMemberRole, removeMember,
      addWorkspaceTasks, moveWorkspaceTask,
      createMeeting, uploadMeetingMock, analyzeMeetingWithAI, processMeetingWithAI,
      updateSuggestedTask, updateMeetingSuggestion, toggleSuggestedTaskSelection,
      removeMeetingSuggestion, createTasksFromSuggestions, createTasksFromMeeting,
      getTasksByMeeting,
      sendInvitation, acceptInvitation, declineInvitation,
      createCustomRole, can, canInWorkspace,
      createTeam, updateTeam, deleteTeam, canAccessTeam,
      addMemberToTeam, removeMemberFromTeam, assignTeamManager,
      initOnboarding, completeOnboardingStep, dismissOnboarding,
      addActivity, addNotification, markNotificationRead, markAllNotificationsRead, setWorkspaceNotificationsEnabled, toggleWorkspaceNotifications, showToast, dismissToast,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Hook to use workspace context
 */
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

export default WorkspaceContext;

function normalizeSuggestion(task) {
  const missingFields = [
    !task.assigneeId ? 'assigneeId' : null,
    !task.deadline ? 'deadline' : null,
  ].filter(Boolean);

  return {
    ...task,
    missingFields,
    needsConfirmation: missingFields.length > 0,
  };
}
