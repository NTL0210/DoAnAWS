import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useWorkspace } from '@/context/WorkspaceContext';
import { VoiceConnectionProvider, useVoiceConnection } from '@/context/VoiceConnectionContext';
import AppShell from '@/components/layout/AppShell';
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal';
import WorkspaceChannelView from '@/components/workspace/WorkspaceChannelView';
import ToastContainer from '@/components/layout/Toast';
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';

export default function WorkspacePage() {
  const router = useRouter();
  const { currentUser, loading, activeWorkspace, workspaceRole } = useWorkspace();

  useEffect(() => {
    if (!loading && !currentUser) router.replace('/login');
  }, [loading, currentUser, router]);

  const user = useMemo(() => {
    if (!currentUser) return null;
    return {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
      role: currentUser.role,
      departmentId: currentUser.departmentId,
      createdAt: currentUser.createdAt,
    };
  }, [currentUser]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background dark:bg-slate-950 p-6">
        <div className="workspace-frame flex h-[calc(100dvh-7.5rem)] w-full max-w-7xl overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-300/40 dark:shadow-slate-950/60">
          <aside className="workspace-sidebar-surface hidden w-[270px] flex-shrink-0 border-r dark:border-slate-800 p-3 md:block">
            <SkeletonRow className="bg-white/60 dark:bg-slate-800/60" />
            <div className="mt-5 space-y-2">
              <SkeletonRow className="bg-white/40 dark:bg-slate-800/40" />
              <SkeletonRow className="bg-white/40 dark:bg-slate-800/40" />
              <SkeletonRow className="bg-white/40 dark:bg-slate-800/40" />
            </div>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col gap-4 p-5">
            <SkeletonCard />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <SkeletonCard className="min-h-48" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <VoiceConnectionProvider currentUser={currentUser} workspaceId={activeWorkspace?.id} workspaceRole={workspaceRole}>
      <VoicePresenceBridge />
      <AppShell user={user} title="" description="">
        {activeWorkspace ? <WorkspaceChannelView /> : <CreateWorkspaceModal />}
        <ToastContainer />
      </AppShell>
    </VoiceConnectionProvider>
  );
}

function VoicePresenceBridge() {
  const { presenceByChannel } = useVoiceConnection();
  const { setVoiceChannelParticipants } = useWorkspace();

  useEffect(() => {
    Object.entries(presenceByChannel || {}).forEach(([channelId, participants]) => {
      setVoiceChannelParticipants(channelId, participants);
    });
  }, [presenceByChannel, setVoiceChannelParticipants]);

  return null;
}
