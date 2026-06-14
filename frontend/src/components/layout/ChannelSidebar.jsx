import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useVoiceConnection } from '@/context/VoiceConnectionContext';
import {
  FiPlus,
  FiVolume2,
  FiCheckSquare,
  FiBarChart2,
  FiHash,
  FiChevronDown,
  FiChevronRight,
  FiHeadphones,
  FiMic,
  FiMicOff,
} from 'react-icons/fi';

/**
 * ChannelSidebar — left sidebar inspired by Discord
 *
 * Structure:
 *   Workspace Name (header)
 *   ── Text Channels ──
 *     # channel (clickable)
 *   ── Voice Channels ──
 *     🔊 voice (clickable)
 *   ─────────────
 *     ☐ Tasks
 *     📊 Analytics
 */
export default function ChannelSidebar() {
  const router = useRouter();
  const {
    activeWorkspace,
    textChannels,
    voiceChannels,
    voiceParticipants,
    activeChannelId,
    activeView,
    selectChannel,
    selectView,
    workspaceMembers,
    workspaceRole,
    can,
    currentUser,
    setShowCreateChannel,
    setShowCreateWorkspace,
    setShowUserMenu,
    showUserMenu,
    logout,
  } = useWorkspace();
  const { onlineUsers } = useVoiceConnection();

  const [textCollapsed, setTextCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);

  const initials = useMemo(() => {
    if (!currentUser) return '?';
    return currentUser.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }, [currentUser]);

  const memberCount = workspaceMembers.length;
  const onlineCount = onlineUsers?.length || (currentUser ? 1 : 0);

  const canCreateChannels = can('channels.create') || workspaceRole === 'OWNER';
  const canViewTasks = can('tasks.view') || workspaceRole === 'OWNER' || workspaceRole === 'MANAGER';
  const canViewAnalytics = can('analytics.view') || workspaceRole === 'OWNER' || workspaceRole === 'MANAGER' || workspaceRole === 'VICE_ADMIN';

  const roleColors = {
    OWNER: '#FF5555',
    VICE_ADMIN: '#FF8C00',
    MANAGER: '#5865F2',
    EMPLOYEE: '#3BA55D',
  };

  const roleLabels = {
    OWNER: 'Owner',
    VICE_ADMIN: 'Vice Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  };

  return (
    <div className="channel-sidebar flex h-full flex-col" style={{ width: 260, minWidth: 260 }}>
      {/* ─── Workspace Name Header ─── */}
      <div
        className="ws-header"
        onClick={() => setShowUserMenu(!showUserMenu)}
        title="Workspace settings"
      >
        <span className="truncate">{activeWorkspace?.name || 'Workspace'}</span>
        <FiChevronDown className="h-4 w-4 text-[#949ba4]" />
      </div>

      {/* ─── Scrollable Channel Area ─── */}
      <div className="flex-1 overflow-y-auto discord-scroll py-2">

        {/* ═══ TEXT CHANNELS ═══ */}
        <div className="section-header" onClick={() => setTextCollapsed(!textCollapsed)}>
          <div className="flex items-center gap-1">
            <FiChevronDown className={`collapse-icon h-3 w-3 ${textCollapsed ? 'collapsed' : ''}`} />
            <span>Text Channels</span>
          </div>
          {canCreateChannels && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateChannel(true);
              }}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-[#36373c] hover:text-white"
              title="Create Channel"
            >
              <FiPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!textCollapsed && (
          <div className="mb-2">
            {textChannels.map((ch) => (
              <div
                key={ch.id}
                className={`channel-item workspace-menu-item ${activeChannelId === ch.id && activeView === null ? 'active is-active' : ''}`}
                onClick={() => selectChannel(ch.id)}
              >
                <FiHash className="hash-icon h-4 w-4" />
                <span className="truncate">{ch.name}</span>
              </div>
            ))}
            {textChannels.length === 0 && (
              <div className="px-4 py-2 text-xs text-[#6d6f78] italic">
                No text channels yet
              </div>
            )}
          </div>
        )}

        {/* ═══ VOICE CHANNELS ═══ */}
        <div className="section-header" onClick={() => setVoiceCollapsed(!voiceCollapsed)}>
          <div className="flex items-center gap-1">
            <FiChevronDown className={`collapse-icon h-3 w-3 ${voiceCollapsed ? 'collapsed' : ''}`} />
            <span>Voice Channels</span>
          </div>
          {canCreateChannels && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateChannel(true);
              }}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-[#36373c] hover:text-white"
              title="Create Voice Channel"
            >
              <FiPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!voiceCollapsed && (
          <div className="mb-2">
            {voiceChannels.map((ch) => {
              const channelParticipants = voiceParticipants[ch.id] || [];
              return (
                <div key={ch.id} className="mb-0.5">
                  <button
                    className={`voice-btn workspace-menu-item ${activeChannelId === ch.id && activeView === null ? 'active is-active' : ''}`}
                    onClick={() => selectChannel(ch.id)}
                  >
                    <FiHeadphones className="voice-icon h-4 w-4" />
                    <span className="truncate">{ch.name}</span>
                    {channelParticipants.length > 0 && (
                      <span className="ml-auto rounded bg-[#36373c] px-1.5 py-0.5 text-[10px] font-bold text-[#949ba4]">
                        {channelParticipants.length}
                      </span>
                    )}
                  </button>
                  {channelParticipants.length > 0 && (
                    <div className="ml-8 mt-1 space-y-0.5">
                      {channelParticipants.map((participant) => {
                        const isSpeaking = participant.isSpeaking && !participant.isMuted;
                        return (
                          <div
                            key={participant.userId}
                            className={`flex items-center gap-2 rounded-md px-1 py-0.5 transition ${isSpeaking ? 'bg-emerald-400/10' : ''}`}
                          >
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                isSpeaking
                                  ? 'animate-pulse bg-emerald-400 shadow-sm shadow-emerald-500/60'
                                  : participant.isMuted
                                    ? 'bg-[#4e5058]'
                                    : 'bg-[#3ba55d]'
                              }`}
                            />
                            <span className={`truncate text-xs ${
                              isSpeaking
                                ? 'font-bold text-[#dbdee1]'
                                : participant.isMuted
                                  ? 'font-medium text-[#6d6f78]'
                                  : 'font-medium text-[#949ba4]'
                            }`}>
                              {participant.name || participant.userId}
                            </span>
                            {participant.isMuted && (
                              <FiMicOff className="ml-auto h-3 w-3 text-[#6d6f78]" />
                            )}
                            {isSpeaking && (
                              <FiMic className="ml-auto h-3 w-3 text-emerald-400" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {voiceChannels.length === 0 && (
              <div className="px-4 py-2 text-xs text-[#6d6f78] italic">
                No voice channels yet
              </div>
            )}
          </div>
        )}

        {/* ═══ DIVIDER ═══ */}
        <div className="mx-3 my-2 border-t border-[#1f2022]" />

        {/* ═══ SPECIAL VIEWS ═══ */}
        {canViewTasks && (
          <div
            className={`channel-item workspace-menu-item ${activeView === 'tasks' ? 'active is-active' : ''}`}
            onClick={() => selectView('tasks')}
          >
            <FiCheckSquare className="mr-2 h-4 w-4 text-[#3ba55d]" />
            <span>Tasks</span>
          </div>
        )}

        {canViewAnalytics && (
          <div
            className={`channel-item workspace-menu-item ${activeView === 'analytics' ? 'active is-active' : ''}`}
            onClick={() => selectView('analytics')}
          >
            <FiBarChart2 className="mr-2 h-4 w-4 text-[#fea55a]" />
            <span>Analytics</span>
          </div>
        )}
      </div>

      {/* ─── User Area (bottom) ─── */}
      <div className="flex items-center gap-2 border-t border-[#1f2022] px-2 py-2">
        <div className="relative">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-[#5865F2] text-sm font-bold text-white" style={{ width: 32, height: 32 }}>
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <span className="online-dot absolute bottom-0 right-0 h-2.5 w-2.5 border-2 border-[#2b2d31]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[#dbdee1]">{currentUser?.name || 'User'}</div>
          <div className="text-xs text-[#949ba4]">{roleLabels[workspaceRole] || 'Member'}</div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="top-nav-btn"
            title="User Settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM4.75 11.5c.35-.8 1.2-1.5 2.75-1.5h1c1.55 0 2.4.7 2.75 1.5A4.98 4.98 0 018 13a4.98 4.98 0 01-3.25-1.5zM8 4a2 2 0 110 4 2 2 0 010-4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
