import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useVoiceConnection } from '@/context/VoiceConnectionContext';
import {
  FiBarChart2,
  FiBell,
  FiBriefcase,
  FiCheckSquare,
  FiChevronDown,
  FiHash,
  FiHeadphones,
  FiHome,
  FiLock,
  FiMail,
  FiMessageSquare,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiSend,
  FiSettings,
  FiUploadCloud,
  FiUserCheck,
  FiUsers,
  FiZap,
  FiStar,
  FiCircle,
} from 'react-icons/fi';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import CreateChannelModal from '@/components/channels/CreateChannelModal';
import WorkspaceAnalytics from '@/components/workspace/WorkspaceAnalytics';
import WorkspaceHomeView from '@/components/workspace/WorkspaceHomeView';
import WorkspaceMeetingsView from '@/components/workspace/WorkspaceMeetingsView';
import WorkspaceTeamsView from '@/components/workspace/WorkspaceTeamsView';
import WorkspaceMembersView from '@/components/workspace/WorkspaceMembersView';
import WorkspaceSettingsView from '@/components/workspace/WorkspaceSettingsView';
import WorkspaceTasksView from '@/components/workspace/WorkspaceTasksView';
import CreateTeamModal from '@/components/workspace/CreateTeamModal';
import VoiceChannelView from '@/components/channels/VoiceChannelView';
import WorkspaceViewTransition from '@/components/workspace/WorkspaceViewTransition';
import CommandPalette from '@/components/workspace/CommandPalette';
import { VALID_WORKSPACE_VIEWS, getQueryView } from '@/lib/workspaceViewUtils';
import usePresence from '@/hooks/usePresence';

export default function WorkspaceChannelView() {
  const router = useRouter();
  const {
    activeWorkspace,
    activeWorkspaceId,
    workspaceRole,
    workspaceRoleLabels,
    workspaceRoleColors,
    textChannels,
    voiceChannels,
    workspaceTeams,
    activeChannelId,
    activeTeamId,
    activeTeam,
    activeView,
    selectChannel,
    selectTeamChat,
    selectView,
    channelMessages,
    activeTeamMessages,
    sendMessage,
    sendTeamMessage,
    currentUser,
    can,
    canAccessTeam,
    workspaceMembers,
    workspaceTasks,
    workspaceMeetings,
    voiceParticipants,
    activeVoiceChannelId,
    activeVoiceRecordings,
    canAccessVoice,
    switchVoiceChannel,
    showCreateChannel,
    setShowCreateChannel,
    showCreateTeam,
    setShowCreateTeam,
    setShowInviteMember,
    showToast,
  } = useWorkspace();
  const { voiceLeaveChannel, onlineUsers: voiceOnlineUsers } = useVoiceConnection();

  const { onlineUsers: presenceOnlineUsers, currentStatus } = usePresence();

  const [message, setMessage] = useState('');
  const [channelsOpen, setChannelsOpen] = useState(() => loadCollapsedState('channelsOpen', true));
  const [teamsOpen, setTeamsOpen] = useState(() => loadCollapsedState('teamsOpen', true));
  const [commandOpen, setCommandOpen] = useState(false);

  // Ref to track internal URL updates vs external ones, preventing sync loops
  const lastSyncedView = useRef(null);

  const allChannels = useMemo(
    () => [...textChannels, ...voiceChannels],
    [textChannels, voiceChannels]
  );

  const currentChannel = activeChannelId
    ? allChannels.find((channel) => channel.id === activeChannelId)
    : null;

  const accessibleTeams = useMemo(
    () => (workspaceTeams || []).filter((team) => canAccessTeam(team)),
    [workspaceTeams, canAccessTeam]
  );

  const canCreateChannels = can('channels.create') || workspaceRole === 'OWNER';
  const canCreateTeams = can('teams.create') || workspaceRole === 'OWNER' || workspaceRole === 'VICE_ADMIN';

  // ─── SINGLE SOURCE OF TRUTH FOR VIEW NAVIGATION ───
  //
  // Design: activeView (state) is the single source of truth.
  // The URL query is a secondary reflection that follows state.
  //
  // - When user clicks sidebar: openWorkspaceView() updates BOTH state AND URL
  // - When URL changes externally (AppShell nav, bookmark, etc.):
  //   the effect below catches it and syncs to state.
  // - ONLY the URL-read effect exists; there is NO state-read effect
  //   because openWorkspaceView handles URL updates inline.
  //
  // This eliminates the bidirectional sync loop entirely.
  //
  // Effect: Read URL → Sync to state (fires on URL changes)
  useEffect(() => {
    if (!router.isReady) return;

    const queryView = getQueryView(router.query);

    // Skip if this URL was set by our own openWorkspaceView call
    if (lastSyncedView.current !== null && queryView === lastSyncedView.current) {
      lastSyncedView.current = null; // Reset for next external navigation
      return;
    }

    if (queryView === 'team-chat') {
      const queryTeamId = Array.isArray(router.query.teamId) ? router.query.teamId[0] : router.query.teamId;
      if (queryTeamId && (activeView !== 'team-chat' || activeTeamId !== queryTeamId)) {
        selectTeamChat(queryTeamId);
      }
    } else if (VALID_WORKSPACE_VIEWS.includes(queryView) && queryView !== activeView) {
      if (queryView === 'home') {
        // 'home' in URL means no view selected — let activeView be null
        if (activeView !== null) {
          selectChannel(null);
        }
      } else {
        selectView(queryView);
      }
    } else if (!queryView && activeView !== null) {
      // URL has no view param but state has one → URL was cleared externally
      // Reset to home
      selectChannel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.asPath]);
  // NOTE: We intentionally exclude `activeView`, `router.query.view`, `selectChannel`,
  // `selectTeamChat`, `selectView`, and `activeTeamId` from deps:
  //   - `router.asPath` catches ALL URL changes (including query), so the effect
  //     fires on every external navigation already.
  //   - Adding `activeView`/`selectView` etc. would create a loop: changing state →
  //     re-render → new `activeView` → effect fires → changes URL → new `asPath` → fires again.
  //   - The guard `lastSyncedView.current` paired with `openWorkspaceView()` prevents
  //     double-applying our own internal updates.

  /**
   * Navigate to a workspace view.
   * Updates BOTH state and URL in one call — no effect needed for the URL update.
   * This is the ONLY way to change views from user interactions.
   */
  const openWorkspaceView = useCallback((view) => {
    if (!VALID_WORKSPACE_VIEWS.includes(view)) return;
    if (view === activeView) return; // Already on this view

    // Mark this as an internal update so the URL-read effect skips it
    lastSyncedView.current = view;

    if (view === 'home') {
      selectChannel(null);
      router.replace('/workspace', undefined, { shallow: true });
    } else {
      selectView(view);
      router.replace(`/workspace?view=${view}`, undefined, { shallow: true });
    }
  }, [activeView, selectView, selectChannel, router]);

  useEffect(() => {
    localStorage.setItem('workspaceSidebar_channelsOpen', String(channelsOpen));
  }, [channelsOpen]);

  useEffect(() => {
    localStorage.setItem('workspaceSidebar_teamsOpen', String(teamsOpen));
  }, [teamsOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (!typing && event.key.toLowerCase() === 'm') {
        window.dispatchEvent(new CustomEvent('workspace:voice-mute-toggle'));
      }
      if (!typing && event.key.toLowerCase() === 'd') {
        window.dispatchEvent(new CustomEvent('workspace:voice-deafen-toggle'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openWorkspaceChannel = useCallback(async (channelId) => {
    const target = allChannels.find((channel) => channel.id === channelId);
    if (target?.type === 'voice') {
      let result = await switchVoiceChannel(channelId);
      if (result?.needsStopConfirm) {
        const confirmed = window.confirm('You are currently recording in another voice channel. Switching will stop the recording and save it. Continue?');
        if (!confirmed) return;
        result = await switchVoiceChannel(channelId, { confirmedStopRecording: true });
      }
      if (result?.needsConsent) {
        const confirmed = window.confirm('This voice channel is currently being recorded. By joining, your voice may be included in the recording. Do you want to join?');
        if (!confirmed) return;
        result = await switchVoiceChannel(channelId, { confirmedTargetRecording: true, confirmedStopRecording: true });
      }
      // Nếu join voice thất bại vẫn cho xem UI (có nút Join để click thủ công)
      if (result?.ok && !result?.unchanged) {
        voiceLeaveChannel();
      }
    }
    selectChannel(channelId);
    // Clear URL query when selecting a channel
    lastSyncedView.current = 'home';
    router.replace('/workspace', undefined, { shallow: true });
  }, [allChannels, router, selectChannel, switchVoiceChannel, voiceLeaveChannel]);

  const openTeamChat = useCallback((teamId) => {
    selectTeamChat(teamId);
    lastSyncedView.current = 'team-chat';
    router.replace(`/workspace?view=team-chat&teamId=${encodeURIComponent(teamId)}`, undefined, { shallow: true });
  }, [router, selectTeamChat]);

  // ─── Sidebar Nav Items ───
  const navItems = [
    { label: 'Home', icon: FiHome, view: 'home', action: () => openWorkspaceView('home') },
    { label: 'Meetings', icon: FiUploadCloud, view: 'meetings', action: () => openWorkspaceView('meetings') },
    { label: 'My Tasks', icon: FiCheckSquare, view: 'tasks', action: () => openWorkspaceView('tasks') },
    { label: 'Analytics', icon: FiBarChart2, view: 'analytics', action: () => openWorkspaceView('analytics') },
  ];

  const managementItems = [
    { label: 'Members', icon: FiUsers, view: 'members', action: () => openWorkspaceView('members') },
    { label: 'Teams', icon: FiBriefcase, view: 'teams', action: () => openWorkspaceView('teams') },
    { label: 'Settings', icon: FiSettings, view: 'settings', action: () => openWorkspaceView('settings') },
  ];

  const isActiveNav = (view) => activeView === view && !currentChannel;
  const viewKey = activeView === 'team-chat' ? `team-${activeTeamId}` : activeView || activeChannelId || 'home';

  const handleSendMessage = (event) => {
    event.preventDefault();
    if (!message.trim() || !currentChannel) return;
    sendMessage(currentChannel.id, message);
    setMessage('');
  };

  const handleSendTeamMessage = (event) => {
    event.preventDefault();
    if (!message.trim() || !activeTeamId) return;
    sendTeamMessage(activeTeamId, message);
    setMessage('');
  };

  // ─── Render current view ───
  const renderContent = () => {
    const contentMap = {
      tasks: <WorkspaceTasksView />,
      meetings: <WorkspaceMeetingsView />,
      analytics: <WorkspaceAnalytics />,
      teams: <WorkspaceTeamsView />,
      members: <WorkspaceMembersView />,
      settings: <WorkspaceSettingsView />,
    };

    if (activeView && contentMap[activeView]) {
      return contentMap[activeView];
    }

    if (activeView === 'team-chat') {
      if (!activeTeam) {
        return <PermissionState title="Team not found" message="This team chat is not available." />;
      }

      if (!canAccessTeam(activeTeam)) {
        return <PermissionState title="No access" message="You do not have access to this team chat." />;
      }

      return (
        <TextChannelContent
          channel={{
            ...activeTeam,
            managerName: getMemberDisplayName(workspaceMembers, activeTeam.managerId),
            memberCount: activeTeam.memberIds?.length || 0,
          }}
          channelType="team"
          messages={activeTeamMessages}
          message={message}
          setMessage={setMessage}
          handleSend={handleSendTeamMessage}
          currentUser={currentUser}
          workspaceMembers={workspaceMembers}
          placeholder={`Message team ${activeTeam.name}`}
          emptyTitle={`Start the conversation with ${activeTeam.name}`}
          emptySubtitle="Messages here stay inside this team."
          onViewMembers={() => openWorkspaceView('teams')}
          onOpenSettings={() => openWorkspaceView('settings')}
          onOpenNotifications={() => showToast('info', '🔔 Notification preferences can be configured in workspace settings.')}
        />
      );
    }

    if (currentChannel) {
      return currentChannel.type === 'voice' ? (
        <VoiceChannelView channel={currentChannel} />
      ) : (
        <TextChannelContent
          channel={currentChannel}
          messages={channelMessages}
          message={message}
          setMessage={setMessage}
          handleSend={handleSendMessage}
          currentUser={currentUser}
          workspaceMembers={workspaceMembers}
          onOpenSettings={() => openWorkspaceView('settings')}
          onOpenNotifications={() => showToast('info', '🔔 Notification preferences can be configured in workspace settings.')}
        />
      );
    }

    return <WorkspaceHomeView />;
  };

  return (
    <div className="workspace-frame workspace-shell flex h-[calc(100dvh-7.5rem)] min-h-0 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-300/40 dark:shadow-slate-950/60 ring-1 ring-white/80 dark:ring-slate-800/80">
      {/* ═══════ SIDEBAR ═══════ */}
      <aside className="workspace-sidebar-surface flex w-[270px] flex-shrink-0 flex-col border-r">
        {/* ─── Workspace Header ─── */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-500 text-xs font-black text-white shadow-lg shadow-blue-500/20">
              {getInitials(activeWorkspace?.name)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{activeWorkspace?.name || 'Workspace'}</h2>
              <p className="truncate text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                {workspaceRoleLabels[workspaceRole] || 'Member'} · {workspaceMembers.length} members
              </p>
            </div>
          </div>
        </div>

        {/* ─── Nav Items ─── */}
        <div className="discord-scroll flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {/* Workspace section */}
          <SidebarSection title="Workspace">
            {navItems.map((item) => (
              <SidebarItem
                key={item.label}
                item={{
                  label: item.label,
                  icon: item.icon,
                  active: isActiveNav(item.view) || (item.view === 'home' && !activeView && !currentChannel),
                  action: item.action,
                }}
              />
            ))}
          </SidebarSection>

          {/* Management section */}
          <SidebarSection title="Management">
            {managementItems.map((item) => (
              <SidebarItem
                key={item.label}
                item={{
                  label: item.label,
                  icon: item.icon,
                  active: isActiveNav(item.view),
                  action: item.action,
                }}
              />
            ))}
          </SidebarSection>

          {/* Teams section — dynamic from workspace data */}
          <SidebarSection
            title="Teams"
            action={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTeamsOpen((v) => !v)}
                  className="workspace-icon-action"
                >
                  <FiChevronDown className={`h-3.5 w-3.5 transition ${teamsOpen ? '' : '-rotate-90'}`} />
                </button>
                {canCreateTeams && (
                  <button
                    type="button"
                    onClick={() => setShowCreateTeam(true)}
                    className="workspace-icon-action"
                    title="Create Team"
                  >
                    <FiPlus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            }
          >
            {teamsOpen && (
              <>
                {accessibleTeams.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 italic">
                    No teams yet
                  </p>
                ) : (
                  accessibleTeams.map((team) => (
                    <SidebarItem
                      key={team.id}
                      compact
                      item={{
                        label: team.name,
                        icon: FiBriefcase,
                        active: activeView === 'team-chat' && activeTeamId === team.id,
                        action: () => openTeamChat(team.id),
                        badge: team.memberIds?.length,
                      }}
                    />
                  ))
                )}
                {canCreateTeams && (
                  <button
                    onClick={() => setShowCreateTeam(true)}
                    className="workspace-add-team flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition"
                  >
                    <FiPlus className="h-3.5 w-3.5" /> Add Team
                  </button>
                )}
              </>
            )}
          </SidebarSection>

          {/* Channels section */}
          <SidebarSection
            title="Channels"
            action={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setChannelsOpen((v) => !v)}
                  className="workspace-icon-action"
                >
                  <FiChevronDown className={`h-3.5 w-3.5 transition ${channelsOpen ? '' : '-rotate-90'}`} />
                </button>
                {canCreateChannels && (
                  <button
                    type="button"
                    onClick={() => setShowCreateChannel(true)}
                    className="workspace-icon-action"
                    title="Create Channel"
                  >
                    <FiPlus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            }
          >
            {channelsOpen && (
              <>
                {textChannels.length === 0 && voiceChannels.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-4 text-center">
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">No channels yet</p>
                    {canCreateChannels ? (
                      <button
                        type="button"
                        onClick={() => setShowCreateChannel(true)}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-blue-700"
                      >
                        <FiPlus className="h-3 w-3" /> Create Channel
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {textChannels.slice(0, 8).map((channel) => (
                  <SidebarItem
                    key={channel.id}
                    compact
                    item={{
                      label: channel.name,
                      icon: FiHash,
                      active: channel.id === activeChannelId,
                      action: () => openWorkspaceChannel(channel.id),
                    }}
                  />
                ))}
                {voiceChannels.map((channel) => {
                  const hasAccess = canAccessVoice(channel);
                  // Ẩn voice channel nếu user ko có quyền (trừ OWNER/VICE_ADMIN)
                  const isAdmin = workspaceRole === 'OWNER' || workspaceRole === 'VICE_ADMIN';
                  if (!hasAccess && !isAdmin) return null;
                  return (
                    <SidebarItem
                      key={channel.id}
                      compact
                      item={{
                        label: channel.name,
                        icon: FiHeadphones,
                        active: channel.id === activeChannelId,
                        action: () => openWorkspaceChannel(channel.id),
                        locked: !hasAccess,
                        connected: channel.id === activeVoiceChannelId,
                        lockTitle: 'You do not have access to this voice channel.',
                        recording: Boolean(activeVoiceRecordings[channel.id]),
                        participants: Object.values(voiceParticipants[channel.id] || {}),
                        workspaceMembers,
                      }}
                    />
                  );
                })}
              </>
            )}
          </SidebarSection>
        </div>

        {/* ─── User Profile ─── */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-[10px] font-black text-white">
              {getInitials(currentUser?.name)}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-800 bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{currentUser?.name || 'User'}</p>
              <p className="truncate text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                {workspaceRoleLabels[workspaceRole] || 'Member'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="workspace-main-surface flex min-w-0 flex-1 bg-white dark:bg-slate-900">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <WorkspaceViewTransition viewKey={viewKey}>
            {renderContent()}
          </WorkspaceViewTransition>
        </div>

        {/* ─── Member Panel (only for channels) ─── */}
        {(currentChannel || (activeView === 'team-chat' && activeTeam && canAccessTeam(activeTeam))) && (
          <MemberPanel
            members={workspaceMembers}
            currentUser={currentUser}
            roleLabels={workspaceRoleLabels}
            onlineUsers={presenceOnlineUsers}
            currentStatus={currentStatus}
          />
        )}
      </main>

      {showCreateChannel && <CreateChannelModal />}
      {showCreateTeam && <CreateTeamModal onClose={() => setShowCreateTeam(false)} />}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onOpenView={openWorkspaceView}
        onCreateTeam={() => setShowCreateTeam(true)}
        onInviteMember={() => setShowInviteMember(true)}
        onJoinVoice={() => {
          const firstVoice = voiceChannels.find((channel) => canAccessVoice(channel));
          if (firstVoice) openWorkspaceChannel(firstVoice.id);
        }}
        onToggleMute={() => window.dispatchEvent(new CustomEvent('workspace:voice-mute-toggle'))}
        onToggleDeafen={() => window.dispatchEvent(new CustomEvent('workspace:voice-deafen-toggle'))}
        meetings={workspaceMeetings}
        tasks={workspaceTasks}
        members={workspaceMembers}
        teams={workspaceTeams}
      />
    </div>
  );
}

/* ════════════════════════════
   SIDEBAR SUB-COMPONENTS
   ════════════════════════════ */

function SidebarSection({ title, action, children }) {
  return (
    <section className="mb-1">
      <div className="mb-1 flex items-center justify-between px-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</h3>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function SidebarItem({ item, compact = false }) {
  const Icon = item.icon;
  const participants = item.participants || [];
  const memberMap = new Map((item.workspaceMembers || []).map((member) => [member.userId, member]));

  return (
    <button
      type="button"
      onClick={item.action}
      title={item.locked ? item.lockTitle : item.label}
      className={`workspace-menu-item group flex w-full items-start gap-2.5 rounded-lg px-2.5 text-left text-sm ${
        compact ? 'py-1.5' : 'py-2'
      } ${item.active ? 'is-active' : ''} ${item.locked ? 'is-locked' : ''}`}
    >
      {Icon && (
        <Icon className="workspace-menu-icon mt-0.5 h-4 w-4 flex-shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{item.label}</span>
          {item.recording ? <FiCircle className="h-3 w-3 fill-rose-500 text-rose-500" /> : null}
          {item.connected ? (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-600">
              Connected
            </span>
          ) : null}
          {item.locked ? <FiLock className="h-3.5 w-3.5 text-slate-400" /> : null}
          {item.badge ? (
            <span className="workspace-menu-badge rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {item.badge}
            </span>
          ) : null}
        </span>
        {item.locked ? (
          <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-400">Locked</span>
        ) : participants.length > 0 ? (
          <span className="mt-1 flex items-center">
            {participants.slice(0, 3).map((participant, index) => {
              const member = memberMap.get(participant.userId);
              const name = member?.nickname || member?.name || participant.name || participant.userId;
              return (
                <span
                  key={participant.userId}
                  className={`-ml-1 first:ml-0 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[8px] font-black text-white ${
                    participant.isSpeaking && !participant.isMuted
                      ? 'border-emerald-400 bg-emerald-500 shadow-sm shadow-emerald-500/50'
                      : participant.isMuted
                        ? 'border-slate-300 bg-slate-400 dark:border-slate-600 dark:bg-slate-500'
                        : 'border-white bg-blue-600'
                  }`}
                  style={{ zIndex: 4 - index }}
                  title={`${name}${participant.isSpeaking && !participant.isMuted ? ' (Speaking)' : participant.isMuted ? ' (Muted)' : ''}`}
                >
                  {getInitials(name)}
                </span>
              );
            })}
            {participants.length > 3 ? (
              <span className="-ml-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-slate-200 px-1 text-[9px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
                +{participants.length - 3}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/* ════════════════════════════
   CHANNEL CONTENT
   ════════════════════════════ */

function TextChannelContent({
  channel,
  channelType = 'channel',
  messages,
  message,
  setMessage,
  handleSend,
  currentUser,
  workspaceMembers,
  placeholder,
  emptyTitle,
  emptySubtitle,
  onViewMembers,
  onOpenSettings,
  onOpenNotifications,
}) {
  const messagesEndRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const isTeam = channelType === 'team';

  const memberMap = useMemo(() => {
    const map = {};
    workspaceMembers.forEach((member) => {
      map[member.userId] = member;
    });
    if (currentUser) map[currentUser.id] = currentUser;
    return map;
  }, [workspaceMembers, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, channel.id]);

  useEffect(() => {
    setVisibleCount(50);
  }, [channel.id]);

  const visibleMessages = useMemo(() => {
    return messages.slice(Math.max(0, messages.length - visibleCount));
  }, [messages, visibleCount]);

  const hasOlderMessages = visibleCount < messages.length;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
            {isTeam ? (
              <FiBriefcase className="h-4 w-4 text-blue-600" />
            ) : (
              <FiHash className="h-4 w-4 text-blue-600" />
            )}
            {channel.name}
          </h2>
          {isTeam ? (
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {channel.description || 'Team chat'} · Manager: {channel.managerName || 'Unassigned'} · {channel.memberCount || 0} members
            </p>
          ) : (
            channel.description && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">{channel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isTeam && (
            <button
              type="button"
              onClick={onViewMembers}
              className="mr-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Members
            </button>
          )}
          <IconButton icon={FiBell} label="Notifications" onClick={onOpenNotifications} />
          <IconButton icon={FiSettings} label="Channel settings" onClick={onOpenSettings} />
        </div>
      </header>

      <div className="discord-scroll flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-8 py-10">
              <FiMessageSquare className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-black text-slate-600 dark:text-slate-300">{emptyTitle || 'No messages yet'}</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{emptySubtitle || `Start the conversation in #${channel.name}.`}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {hasOlderMessages && (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 50)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Load older messages
                </button>
              </div>
            )}
            {visibleMessages.map((msg) => {
              const user = memberMap[msg.userId] || {};
              return (
                <MessageItem key={msg.id} msg={msg} user={user} />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
        {messages.length === 0 && <div ref={messagesEndRef} />}
      </div>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <form onSubmit={handleSend} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 focus-within:border-blue-200 dark:focus-within:border-blue-800 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-4 focus-within:ring-blue-50 dark:focus-within:ring-blue-900/20">
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-white dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300">
            <FiPaperclip className="h-4 w-4" />
          </button>
          <input
            type="text"
            className="h-8 min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder={placeholder || `Message #${channel.name}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && (event.preventDefault(), handleSend(event))}
          />
          <button type="submit" disabled={!message.trim()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50">
            <FiSend className="h-4 w-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}

const MessageItem = memo(function MessageItem({ msg, user }) {
  return (
    <article className="group flex gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-[10px] font-black text-white">
        {getInitials(user.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-black text-slate-900 dark:text-slate-100">{user.name || 'Unknown'}</span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{formatTime(msg.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{msg.content}</p>
        {msg.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 shadow-sm">
                {attachment.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
});

function VoiceChannelContent({ channel, workspaceMembers, workspaceRole, can }) {
  const canRecord = can('meetings.record') || workspaceRole === 'OWNER' || workspaceRole === 'MANAGER';
  const [joined, setJoined] = useState(false);
  const [recording, setRecording] = useState(false);

  return (
    <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900 p-8">
      <div className="max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <FiHeadphones className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-slate-100">{channel.name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-500">
          Voice channel for {workspaceMembers.length} workspace members.
        </p>
        <div className="mt-4 rounded-2xl border border-white dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-left shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-500 dark:text-slate-400">Status</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${joined ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
              {joined ? 'Connected' : 'Not joined'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="font-bold text-slate-500 dark:text-slate-400">Recording</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${recording ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
              {recording ? 'Live' : 'Off'}
            </span>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => { setJoined((v) => { if (v) setRecording(false); return !v; }); }}
            className={`rounded-xl px-5 py-3 text-sm font-black shadow-lg transition ${
              joined
                ? 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600'
                : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'
            }`}
          >
            {joined ? 'Leave Voice' : 'Join Voice'}
          </button>
          {canRecord && (
            <button
              type="button"
              disabled={!joined}
              onClick={() => setRecording((v) => !v)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-black text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {recording ? 'Stop Recording' : 'Start Recording'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberPanel({ members, currentUser, roleLabels, onlineUsers = [], currentStatus }) {
  // onlineUsers from usePresence: { userId, name, status: 'online'|'idle', lastSeen }
  const onlineById = useMemo(() => {
    const map = new Map();
    (onlineUsers || []).forEach((u) => map.set(u.userId, u));
    if (currentStatus) map.set(currentStatus.userId, currentStatus);
    return map;
  }, [onlineUsers, currentStatus]);

  const allMembers = useMemo(() => {
    const byId = new Map();
    members.forEach((member) => byId.set(member.userId, member));
    if (currentUser?.id && !byId.has(currentUser.id)) {
      byId.set(currentUser.id, { userId: currentUser.id, name: currentUser.name, avatar: currentUser.avatar, role: 'OWNER' });
    }
    onlineById.forEach((presence, userId) => {
      if (!byId.has(userId)) byId.set(userId, { userId, name: presence.name });
    });
    return Array.from(byId.values());
  }, [currentUser, members, onlineById]);

  const onlineMembers = allMembers.filter((member) => onlineById.get(member.userId)?.status === 'online');
  const idleMembers = allMembers.filter((member) => onlineById.get(member.userId)?.status === 'idle');
  const offlineMembers = allMembers.filter((member) => {
    const p = onlineById.get(member.userId);
    return !p || p.status === 'offline';
  });

  const renderMember = (member, index, statusType) => {
    const presence = onlineById.get(member.userId) || {};
    const name = member.nickname || member.name || presence.name || (member.userId === currentUser?.id ? currentUser.name : 'Unknown');
    const role = member.role || presence.role || 'Member';
    const isOnline = statusType === 'online';
    const isIdle = statusType === 'idle';
    return (
      <button key={member.userId || index} type="button" className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm">
        <span className={`relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${isOnline ? 'bg-gradient-to-br from-blue-500 to-cyan-400' : isIdle ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
          {getInitials(name)}
          <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
            isOnline ? 'bg-emerald-500' : isIdle ? 'bg-amber-400' : 'bg-slate-400 dark:bg-slate-500'
          }`} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className={`block truncate text-xs font-black ${isOnline ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>{name}</span>
            {isIdle && <span className="text-[9px] font-bold text-amber-500 dark:text-amber-400">Idle</span>}
          </span>
          <span className="block truncate text-[10px] font-semibold text-slate-400 dark:text-slate-500">
            {roleLabels[role] || role}
          </span>
        </span>
      </button>
    );
  };

  return (
    <aside className="hidden w-[220px] flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 xl:flex xl:flex-col">
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">Online</h3>
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
            {onlineMembers.length}
          </span>
        </div>
      </div>
      <div className="discord-scroll flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {onlineMembers.map((member, index) => renderMember(member, index, 'online'))}

          {idleMembers.length > 0 ? (
            <div className="px-2 pb-1 pt-3 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
              Idle — {idleMembers.length}
            </div>
          ) : null}
          {idleMembers.map((member, index) => renderMember(member, index, 'idle'))}

          {offlineMembers.length > 0 ? (
            <div className="px-2 pb-1 pt-3 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
              Offline — {offlineMembers.length}
            </div>
          ) : null}
          {offlineMembers.map((member, index) => renderMember(member, index, 'offline'))}
        </div>
      </div>
    </aside>
  );
}

function PermissionState({ title, message }) {
  return (
    <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900 p-8 text-center">
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-8 py-10">
        <FiUserCheck className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-300">{title}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300">
      <Icon className="h-4 w-4" />
    </button>
  );
}

function getMemberDisplayName(members, userId) {
  if (!userId) return '';
  const member = members.find((item) => item.userId === userId);
  return member?.name || member?.nickname || 'Unknown';
}

function getInitials(name) {
  if (!name) return 'AI';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function loadCollapsedState(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const stored = localStorage.getItem(`workspaceSidebar_${key}`);
  return stored === null ? fallback : stored === 'true';
}
