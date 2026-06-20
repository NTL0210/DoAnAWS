import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiBriefcase, FiChevronDown, FiLoader, FiLock, FiMail, FiShield, FiUser, FiUserCheck, FiUserX, FiUsers } from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';

export default function AdminUsers() {
  const {
    currentUser, loading, workspaces,
    activeWorkspace, activeWorkspaceId, selectWorkspace,
    workspaceRole, workspaceMembers,
  } = useWorkspace();
  const [filterRole, setFilterRole] = useState('all');
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

  const members = useMemo(() => {
    return workspaceMembers.map((m) => ({
      id: m.userId,
      name: m.name || m.nickname || 'Unknown',
      email: m.email || '',
      role: m.role || 'EMPLOYEE',
      avatar: m.avatar || '',
      status: m.status || 'ACTIVE',
      departmentId: activeWorkspace?.id || null,
      deptName: activeWorkspace?.name || '—',
    }));
  }, [workspaceMembers, activeWorkspace]);

  const isOwner = workspaceRole === 'OWNER';

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
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a workspace to manage its members.</p>
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
            You need the Owner role in <strong>{activeWorkspace.name}</strong> to manage members.
          </p>
          <Link href="/workspace" className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Go to Workspace</Link>
        </div>
      </AppShell>
    );
  }

  const filtered = useMemo(() => {
    if (filterRole === 'all') return members;
    return members.filter((m) => m.role === filterRole);
  }, [members, filterRole]);

  const roleCounts = {
    all: members.length,
    OWNER: members.filter((m) => m.role === 'OWNER').length,
    VICE_ADMIN: members.filter((m) => m.role === 'VICE_ADMIN').length,
    MANAGER: members.filter((m) => m.role === 'MANAGER').length,
    EMPLOYEE: members.filter((m) => m.role === 'EMPLOYEE').length,
  };

  const roleLabels = {
    OWNER: 'Owner',
    VICE_ADMIN: 'Vice Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  };

  return (
    <AppShell
      user={user}
      eyebrow={activeWorkspace?.name || 'Admin'}
      title="Member management"
      description={`${roleCounts.all} members · ${roleCounts.OWNER} owner · ${roleCounts.VICE_ADMIN} vice admin · ${roleCounts.MANAGER} manager · ${roleCounts.EMPLOYEE} employees`}
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
        <StatCard label="Total members" value={roleCounts.all} detail="All workspace members" icon={FiUsers} tone="blue" />
        <StatCard label="Owners" value={roleCounts.OWNER} detail="Workspace owners" icon={FiShield} tone="red" />
        <StatCard label="Managers" value={roleCounts.MANAGER} detail="Department managers" icon={FiUserCheck} tone="amber" />
        <StatCard label="Employees" value={roleCounts.EMPLOYEE} detail="Team members" icon={FiUser} tone="green" />
      </div>

      <Panel title={`Members (${filtered.length})`} description="Filter by role to manage access" className="mt-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: roleCounts.all },
            { key: 'OWNER', label: 'Owner', count: roleCounts.OWNER },
            { key: 'VICE_ADMIN', label: 'Vice Admin', count: roleCounts.VICE_ADMIN },
            { key: 'MANAGER', label: 'Manager', count: roleCounts.MANAGER },
            { key: 'EMPLOYEE', label: 'Employee', count: roleCounts.EMPLOYEE },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterRole(f.key)}
              className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                filterRole === f.key
                  ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={FiUsers} title="No members found" description="Try a different filter or invite new members." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m, idx) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-[#17212c]"
              >
                <img
                  src={m.avatar}
                  alt={m.name}
                  className="h-12 w-12 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.name}</h3>
                    <StatusPill tone={roleTone(m.role)}>{roleLabels[m.role] || m.role}</StatusPill>
                  </div>
                  {m.email && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <FiMail className="h-3 w-3" />
                      {m.email}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{m.deptName}</p>
                </div>
                <div className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  m.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  {m.status}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function roleTone(role) {
  if (role === 'OWNER') return 'red';
  if (role === 'VICE_ADMIN') return 'purple';
  if (role === 'MANAGER') return 'amber';
  return 'blue';
}
