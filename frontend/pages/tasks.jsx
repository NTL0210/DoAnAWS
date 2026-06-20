import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiLock,
  FiSliders,
  FiUser,
  FiUsers,
  FiTarget,
  FiEye,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, EmptyState } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';

export default function UnifiedTasks() {
  const {
    currentUser, loading, workspaces,
    activeWorkspace, activeWorkspaceId, selectWorkspace,
    workspaceRole, workspaceTasks, workspaceMembers,
  } = useWorkspace();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');

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
    return workspaces.filter((ws) => ws.members?.some((m) => m.userId === currentUser.id));
  }, [workspaces, currentUser]);

  const effectiveRole = workspaceRole || currentUser?.role;
  const isOwner = effectiveRole === 'OWNER';
  const isManagerOrAbove = ['OWNER', 'VICE_ADMIN', 'MANAGER'].includes(effectiveRole);

  const scopedTasks = useMemo(
    () => (workspaceTasks || []).filter((t) => t.workspaceId === activeWorkspace?.id || t.departmentId === activeWorkspace?.id),
    [workspaceTasks, activeWorkspace]
  );

  const memberMap = useMemo(() => {
    const map = {};
    workspaceMembers.forEach((m) => { map[m.userId] = m.name || m.nickname || 'Unknown'; });
    return map;
  }, [workspaceMembers]);

  // Employee view: only own tasks
  const myTasks = useMemo(() => scopedTasks.filter((t) => t.assigneeId === user?.id), [scopedTasks, user]);

  const enhanced = useMemo(() => {
    const source = effectiveRole === 'EMPLOYEE' ? myTasks : scopedTasks;
    let list = source.map((t) => ({
      ...t,
      assigneeName: memberMap[t.assigneeId] || 'Unassigned',
    }));
    if (filterStatus !== 'all') list = list.filter((t) => t.status === filterStatus);
    if (filterPriority !== 'all' && isManagerOrAbove) list = list.filter((t) => t.priority === filterPriority);
    list.sort((a, b) => {
      if (sortBy === 'priority') return priorityRank(b.priority) - priorityRank(a.priority);
      if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
      return new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01');
    });
    return list;
  }, [scopedTasks, myTasks, filterStatus, filterPriority, sortBy, memberMap, effectiveRole, isManagerOrAbove]);

  const counts = useMemo(() => {
    const source = effectiveRole === 'EMPLOYEE' ? myTasks : scopedTasks;
    return {
      total: source.length,
      pending: source.filter((t) => t.status === 'PENDING').length,
      inProgress: source.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: source.filter((t) => t.status === 'COMPLETED').length,
      overdue: source.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED').length,
    };
  }, [scopedTasks, myTasks, effectiveRole]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
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
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a workspace to view its tasks.</p>
          <div className="mt-6 space-y-2">
            {myWorkspaces.map((ws) => (
              <button key={ws.id} type="button" onClick={() => selectWorkspace(ws.id)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
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

  // Role guard for manager/admin tasks
  if (!isManagerOrAbove && effectiveRole !== 'EMPLOYEE') {
    return (
      <AppShell user={user} showWorkspaceSwitcher={false}>
        <div className="mx-auto mt-20 max-w-lg px-4 text-center">
          <FiLock className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">Access restricted</h2>
          <p className="mt-2 text-sm text-slate-500">You don't have permission to view these tasks.</p>
        </div>
      </AppShell>
    );
  }

  const statusFilters = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'PENDING', label: 'Pending', count: counts.pending },
    { key: 'IN_PROGRESS', label: 'In Progress', count: counts.inProgress },
    { key: 'COMPLETED', label: 'Completed', count: counts.completed },
  ];

  return (
    <AppShell
      user={user}
      eyebrow={activeWorkspace?.name || 'Tasks'}
      title={effectiveRole === 'EMPLOYEE' ? 'My tasks' : 'All tasks'}
      description={
        effectiveRole === 'EMPLOYEE'
          ? `${counts.total} tasks · ${counts.pending} pending · ${counts.completed} completed`
          : `${counts.total} tasks · ${counts.completed} completed · ${counts.inProgress} in progress · ${counts.overdue} overdue`
      }
      actions={
        isManagerOrAbove && (
          <Link href="/workspace?view=meetings" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700">
            <FiFileText className="h-4 w-4" />Upload meeting
          </Link>
        )
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={effectiveRole === 'EMPLOYEE' ? 'My tasks' : 'Total tasks'} value={counts.total} detail="All tasks" icon={effectiveRole === 'EMPLOYEE' ? FiTarget : FiBriefcase} tone="blue" />
        <StatCard label="Pending" value={counts.pending} detail="Waiting to start" icon={FiClock} tone="slate" />
        <StatCard label="In progress" value={counts.inProgress} detail="Currently active" icon={FiBarChart2} tone="amber" />
        <StatCard label="Overdue" value={counts.overdue} detail="Needs attention" icon={FiAlertTriangle} tone={counts.overdue ? 'red' : 'slate'} />
      </div>

      <Panel title={`Tasks (${enhanced.length})`} description="Filter and sort your workload" className="mt-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <button key={f.key} type="button" onClick={() => setFilterStatus(f.key)}
                className={`h-9 rounded-lg px-3 text-sm font-bold transition ${filterStatus === f.key ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950' : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FiSliders className="h-4 w-4 text-slate-400" />
            {isManagerOrAbove && (
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-[#fbfcfe] px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="all">All priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            )}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-[#fbfcfe] px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <option value="deadline">Sort: Deadline</option>
              <option value="priority">Sort: Priority</option>
              <option value="progress">Sort: Progress</option>
            </select>
          </div>
        </div>

        {enhanced.length === 0 ? (
          <EmptyState icon={FiCheckCircle} title="No tasks match" description="Try adjusting your filters." />
        ) : (
          <div className="space-y-2">
            {enhanced.map((task, idx) => {
              const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'COMPLETED';
              const isCompact = effectiveRole === 'OWNER' || effectiveRole === 'VICE_ADMIN';
              if (isCompact) {
                return (
                  <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                    className="flex items-center gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] px-4 py-3 text-sm transition hover:border-primary-200 dark:border-slate-800 dark:bg-[#17212c]">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</span>
                        <StatusPill tone={statusTone(task.status)}>{task.status.replace('_', ' ')}</StatusPill>
                        <StatusPill tone={priorityTone(task.priority)}>{task.priority}</StatusPill>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><FiUser className="h-3 w-3" />{task.assigneeName}</span>
                        <span className="inline-flex items-center gap-1"><FiCalendar className="h-3 w-3" />{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}</span>
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className={`h-full rounded-full ${task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary-600'}`} style={{ width: `${task.progress || 0}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{task.progress || 0}%</p>
                    </div>
                  </motion.div>
                );
              }
              return (
                <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                  className="rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-[#17212c]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={statusTone(task.status)}>{task.status.replace('_', ' ')}</StatusPill>
                        <StatusPill tone={priorityTone(task.priority)}>{task.priority}</StatusPill>
                        {overdue && <StatusPill tone="red">OVERDUE</StatusPill>}
                      </div>
                      <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{task.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{task.description}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                        {effectiveRole !== 'EMPLOYEE' && task.assigneeName && (
                          <span className="inline-flex items-center gap-1.5"><FiUser className="h-3.5 w-3.5" />{task.assigneeName}</span>
                        )}
                        <span className="inline-flex items-center gap-1.5"><FiCalendar className="h-3.5 w-3.5" />{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}</span>
                        <span className="inline-flex items-center gap-1.5"><FiClock className="h-3.5 w-3.5" />{task.progress || 0}% complete</span>
                      </div>
                    </div>
                    <div className="w-full lg:w-44">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Progress</span><span>{task.progress || 0}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                        <div className={`h-full rounded-full transition-all ${task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary-600'}`} style={{ width: `${task.progress || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Panel>

      {effectiveRole === 'EMPLOYEE' && counts.overdue > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300"><FiClock className="h-4 w-4" /></span>
          You have {counts.overdue} overdue task{counts.overdue > 1 ? 's' : ''} that need{counts.overdue === 1 ? 's' : ''} your attention.
        </motion.div>
      )}
    </AppShell>
  );
}

function priorityRank(p) {
  return { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[p] || 0;
}
function statusTone(s) {
  if (s === 'COMPLETED') return 'green';
  if (s === 'IN_PROGRESS') return 'blue';
  if (s === 'PENDING') return 'amber';
  if (s === 'OVERDUE') return 'red';
  return 'slate';
}
function priorityTone(p) {
  if (p === 'URGENT' || p === 'HIGH') return 'red';
  if (p === 'MEDIUM') return 'amber';
  return 'green';
}
