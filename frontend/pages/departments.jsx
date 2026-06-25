import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiBriefcase, FiChevronDown, FiLoader, FiLock, FiUsers, FiCheckCircle, FiUser, FiPlus } from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';

export default function AdminDepartments() {
  const {
    currentUser, loading, workspaces,
    activeWorkspace, activeWorkspaceId, selectWorkspace,
    workspaceRole, workspaceTeams, workspaceMembers,
  } = useWorkspace();
  const [showWsPicker, setShowWsPicker] = useState(false);

  const user = useMemo(() => {
    if (!currentUser) return null;
    return {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
      role: workspaceRole || currentUser.role,
      departmentId: currentUser.departmentId,
      createdAt: currentUser.createdAt,
    };
  }, [currentUser, workspaceRole]);

  const myWorkspaces = useMemo(() => {
    if (!currentUser) return [];
    return workspaces.filter((ws) =>
      ws.members?.some((m) => m.userId === currentUser.id)
    );
  }, [workspaces, currentUser]);

  const isOwner = workspaceRole === 'OWNER';

  const enhancedTeams = useMemo(() => {
    if (!workspaceTeams || !workspaceMembers) return [];
    return workspaceTeams.map((team) => {
      const teamMemberList = workspaceMembers.filter((m) =>
        (team.memberIds || []).includes(m.userId)
      );
      const teamLead = workspaceMembers.find((m) =>
        m.userId === team.leadId
      );
      return {
        id: team.id,
        name: team.name || team.title || 'Unnamed Team',
        description: team.description || '',
        memberCount: teamMemberList.length,
        members: teamMemberList,
        leadName: teamLead?.name || teamLead?.nickname || 'Unassigned',
        channelCount: (team.channels || []).length,
      };
    });
  }, [workspaceTeams, workspaceMembers]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="text-center">
          <FiLock className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-4 text-sm font-medium text-slate-500">Please log in first.</p>
          <Link href="/login" className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Go to Login</Link>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <AppShell user={user} showWorkspaceSwitcher={false}>
        <div className="mx-auto mt-20 max-w-lg px-4 text-center">
          <FiBriefcase className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">Select a workspace</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a workspace to manage its teams.</p>
          <div className="mt-6 space-y-2">
            {myWorkspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => selectWorkspace(ws.id)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                {ws.name}
              </button>
            ))}
            {myWorkspaces.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-500">
                No workspaces yet. <Link href="/workspace" className="text-primary-600">Create one</Link>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!isOwner) {
    return (
      <AppShell user={user} showWorkspaceSwitcher={false}>
        <div className="mx-auto mt-20 max-w-lg px-4 text-center">
          <FiLock className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">Owner access required</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            You need the Owner role in <strong>{activeWorkspace.name}</strong> to manage teams.
          </p>
          <Link href="/workspace" className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Go to Workspace</Link>
        </div>
      </AppShell>
    );
  }

  const totalMembers = workspaceMembers.length;
  const totalTeams = enhancedTeams.length;

  return (
    <AppShell
      user={user}
      eyebrow={activeWorkspace?.name || 'Admin'}
      title="Team management"
      description={`${totalTeams} teams · ${totalMembers} total members in ${activeWorkspace.name}`}
    >
      <div className="relative mb-4">
        <button
          type="button"
          onClick={() => setShowWsPicker(!showWsPicker)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <FiBriefcase className="h-4 w-4" />
          {activeWorkspace.name}
          <FiChevronDown className="h-4 w-4" />
        </button>
        {showWsPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowWsPicker(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-lg">
              {myWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => { selectWorkspace(ws.id); setShowWsPicker(false); }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    ws.id === activeWorkspaceId
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {ws.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Teams" value={totalTeams} detail="Operating units" icon={FiBriefcase} tone="blue" />
        <StatCard label="Members" value={totalMembers} detail="Across workspace" icon={FiUsers} tone="green" />
        <StatCard label="Avg team size" value={totalTeams ? Math.round(totalMembers / totalTeams) : 0} detail="Members per team" icon={FiUser} tone="amber" />
        <StatCard label="Channels" value={enhancedTeams.reduce((s, t) => s + t.channelCount, 0)} detail="Total across teams" icon={FiCheckCircle} tone="slate" />
      </div>

      <Panel title={`Teams (${totalTeams})`} description={`Teams inside ${activeWorkspace.name}`} className="mt-6">
        {enhancedTeams.length === 0 ? (
          <EmptyState icon={FiBriefcase} title="No teams yet" description="Create your first team in this workspace to get started." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {enhancedTeams.map((team, idx) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-lg border border-slate-200/80 bg-[#f4f7fb] p-5 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{team.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Lead: <span className="font-semibold">{team.leadName}</span>
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                    <FiUsers className="h-5 w-5" />
                  </div>
                </div>

                {team.description && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 line-clamp-2">{team.description}</p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-md bg-white/80 p-2 dark:bg-slate-800">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{team.memberCount}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Members</p>
                  </div>
                  <div className="rounded-md bg-white/80 p-2 dark:bg-slate-800">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{team.channelCount}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Channels</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
