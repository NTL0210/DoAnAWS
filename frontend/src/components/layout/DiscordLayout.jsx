import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWorkspace } from '@/context/WorkspaceContext';
import ChannelSidebar from './ChannelSidebar';
import TopNavigation from './TopNavigation';
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal';
import CreateChannelModal from '@/components/channels/CreateChannelModal';
import TextChannelView from '@/components/channels/TextChannelView';
import VoiceChannelView from '@/components/channels/VoiceChannelView';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import WorkspaceAnalytics from '@/components/workspace/WorkspaceAnalytics';

/**
 * DiscordLayout — Main layout wrapper
 *
 * Structure:
 * ┌──────────┬──────────────────────────────┐
 * │           │  TopNavigation                │
 * │ Channel   │  ─────────────────────────── │
 * │ Sidebar   │  Main Content Area            │
 * │ (260px)   │                               │
 * │           │                               │
 * └──────────┴──────────────────────────────┘
 */
export default function DiscordLayout({ children }) {
  const router = useRouter();
  const {
    currentUser,
    loading,
    activeWorkspace,
    activeChannel,
    activeView,
    textChannels,
    selectChannel,
    showCreateWorkspace,
    showCreateChannel,
    workspaceMembers,
    workspaceRole,
  } = useWorkspace();

  // On mount, if user is logged in but has no workspace, stay on dashboard
  // If user has workspace but no channel selected, select first text channel
  useEffect(() => {
    if (!loading && currentUser && activeWorkspace && !activeChannel && !activeView) {
      const general = activeWorkspace.channels.find(
        (c) => c.isDefault && c.type === 'text'
      );
      if (general) selectChannel(general.id);
    }
  }, [loading, currentUser, activeWorkspace, activeChannel, activeView, selectChannel]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: '#313338' }}>
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#5865F2] border-t-transparent" />
          <p className="mt-4 text-sm text-[#949ba4]">Loading...</p>
        </div>
      </div>
    );
  }

  // No user -> redirect to login
  if (!currentUser) {
    router.replace('/login');
    return null;
  }

  // No workspace -> show create workspace
  if (!activeWorkspace) {
    return (
      <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#313338' }}>
        {/* Minimal top bar */}
        <div className="flex h-12 items-center justify-between border-b border-[#1f2022] px-4" style={{ backgroundColor: '#2b2d31' }}>
          <div className="text-sm font-semibold text-[#dbdee1]">AI Meeting Platform</div>
          <div className="flex items-center gap-2 text-sm text-[#949ba4]">
            <span>{currentUser.name}</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5865F2] text-[10px] font-bold text-white">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <CreateWorkspaceModal />
        </div>
      </div>
    );
  }

  // Determine main content based on active view/channel
  const renderMainContent = () => {
    if (activeView === 'tasks') {
      return <KanbanBoard />;
    }
    if (activeView === 'analytics') {
      return <WorkspaceAnalytics />;
    }
    if (activeChannel) {
      if (activeChannel.type === 'voice') {
        return <VoiceChannelView />;
      }
      // Text channel
      return <TextChannelView />;
    }
    // Fallback: show welcome
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">👋</div>
          <h2 className="text-xl font-bold text-[#dbdee1] mb-2">
            Welcome to {activeWorkspace.name}
          </h2>
          <p className="text-sm text-[#949ba4] max-w-md">
            Select a channel from the sidebar to start collaborating with your team.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#313338' }}>
      {/* ─── Left Sidebar ─── */}
      <ChannelSidebar />

      {/* ─── Main Content ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNavigation />
        <div className="flex-1 overflow-y-auto discord-scroll" style={{ backgroundColor: '#313338' }}>
          {renderMainContent()}
          {children}
        </div>
      </div>

      {/* ─── Modals ─── */}
      {showCreateChannel && <CreateChannelModal />}
    </div>
  );
}
