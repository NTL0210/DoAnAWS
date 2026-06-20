import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiLock,
  FiShield,
  FiTrendingUp,
  FiUsers,
  FiZap,
  FiChevronDown,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';

export default function UnifiedAnalytics() {
  const {
    currentUser, loading, workspaces,
    activeWorkspace, activeWorkspaceId, selectWorkspace,
    workspaceRole, workspaceTasks, workspaceMeetings, workspaceMembers,
  } = useWorkspace();

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
  const scopedMeetings = useMemo(
    () => (workspaceMeetings || []).filter((m) => m.workspaceId === activeWorkspace?.id),
    [workspaceMeetings, activeWorkspace]
  );

  const analytics = useMemo(() => {
    if (!activeWorkspace) return null;

    const totalMembers = workspaceMembers.length;
    const totalMeetings = scopedMeetings.length;
    const completedMeetings = scopedMeetings.filter((m) => m.status === 'COMPLETED').length;
    const processingMeetings = scopedMeetings.filter((m) => m.status === 'PROCESSING').length;

    const totalTasks = scopedTasks.length;
    const completedTasks = scopedTasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgressTasks = scopedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const pendingTasks = scopedTasks.filter((t) => t.status === 'PENDING').length;
    const overdueTasks = scopedTasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED').length;

    const avgProgress = totalTasks ? Math.round(scopedTasks.reduce((s, t) => s + t.progress, 0) / totalTasks) : 0;

    // Priority distribution
    const priorityDist = {
      URGENT: scopedTasks.filter((t) => t.priority === 'URGENT').length,
      HIGH: scopedTasks.filter((t) => t.priority === 'HIGH').length,
      MEDIUM: scopedTasks.filter((t) => t.priority === 'MEDIUM').length,
      LOW: scopedTasks.filter((t) => t.priority === 'LOW').length,
    };

    // Member productivity
    const memberProductivity = workspaceMembers.map((m) => {
      const memberTasks = scopedTasks.filter((t) => t.assigneeId === m.userId);
      const done = memberTasks.filter((t) => t.status === 'COMPLETED').length;
      return {
        name: m.name || m.nickname || 'Unknown',
        total: memberTasks.length,
        completed: done,
        rate: memberTasks.length ? Math.round((done / memberTasks.length) * 100) : 0,
      };
    }).filter((p) => p.total > 0);

    const roleDist = {};
    workspaceMembers.forEach((m) => {
      const role = m.role || 'EMPLOYEE';
      roleDist[role] = (roleDist[role] || 0) + 1;
    });

    return {
      activeUsers: totalMembers,
      totalMeetings, completedMeetings, processingMeetings,
      totalTasks, completedTasks, inProgressTasks, pendingTasks, overdueTasks,
      avgProgress, priorityDist, memberProductivity, roleDist,
      workspaceName: activeWorkspace.name,
    };
  }, [activeWorkspace, workspaceMembers, workspaceTasks, scopedMeetings, scopedTasks]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Loading workspace analytics...</p>
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
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a workspace to view its analytics.</p>
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

  // For EMPLOYEE, show a simpler view
  if (effectiveRole === 'EMPLOYEE') {
    return <EmployeeAnalyticsContent user={user} analytics={analytics} activeWorkspace={activeWorkspace} selectWorkspace={selectWorkspace} myWorkspaces={myWorkspaces} activeWorkspaceId={activeWorkspaceId} />;
  }

  // For MANAGER (not owner): show manager analytics
  if (isManagerOrAbove && !isOwner) {
    return <ManagerAnalyticsContent user={user} analytics={analytics} activeWorkspace={activeWorkspace} selectWorkspace={selectWorkspace} myWorkspaces={myWorkspaces} activeWorkspaceId={activeWorkspaceId} />;
  }

  // For OWNER: show full admin analytics
  if (!isOwner) {
    return (
      <AppShell user={user} showWorkspaceSwitcher={false}>
        <div className="mx-auto mt-20 max-w-lg px-4 text-center">
          <FiLock className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">Owner access required</h2>
          <p className="mt-2 text-sm text-slate-500">You need the Owner role in <strong>{activeWorkspace.name}</strong> to view analytics.</p>
          <Link href="/workspace" className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Go to Workspace</Link>
        </div>
      </AppShell>
    );
  }

  if (!analytics) return null;

  const maxPriority = Math.max(...Object.values(analytics.priorityDist), 1);

  return (
    <AppShell user={user} eyebrow={activeWorkspace?.name || 'Admin'} title="Workspace analytics"
      description={`High-level metrics for ${analytics.workspaceName}`}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active members" value={analytics.activeUsers} detail="Workspace members" icon={FiUsers} tone="blue" />
        <StatCard label="Meetings" value={analytics.totalMeetings} detail={`${analytics.completedMeetings} completed`} icon={FiFileText} tone="amber" />
        <StatCard label="Tasks" value={analytics.totalTasks} detail={`${analytics.completedTasks} completed`} icon={FiCheckCircle} tone="green" />
        <StatCard label="Avg progress" value={`${analytics.avgProgress}%`} detail="Workspace-wide" icon={FiTrendingUp} tone="slate" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Priority distribution */}
        <Panel title="Priority distribution" description="Task count by priority level">
          <div className="space-y-4">
            {[
              { key: 'URGENT', label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-600' },
              { key: 'HIGH', label: 'High', color: 'bg-orange-500', textColor: 'text-orange-600' },
              { key: 'MEDIUM', label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
              { key: 'LOW', label: 'Low', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-4">
                <span className={`w-16 text-xs font-bold ${item.textColor}`}>{item.label}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(analytics.priorityDist[item.key] / maxPriority) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${item.color}`}
                    style={{ minWidth: analytics.priorityDist[item.key] ? '20px' : 0 }} />
                </div>
                <span className="w-8 text-right text-sm font-bold text-slate-700 dark:text-slate-300">{analytics.priorityDist[item.key]}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Role distribution */}
        <Panel title="Role distribution" description="Member breakdown by role">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(analytics.roleDist).map(([role, count]) => {
              const max = Math.max(...Object.values(analytics.roleDist), 1);
              const colorSet = role === 'OWNER'
                ? { icon: FiBarChart2, from: 'from-red-500 to-rose-400' }
                : role === 'VICE_ADMIN'
                  ? { icon: FiShield, from: 'from-purple-500 to-violet-400' }
                  : role === 'MANAGER'
                    ? { icon: FiBriefcase, from: 'from-amber-500 to-orange-400' }
                    : { icon: FiUsers, from: 'from-emerald-500 to-teal-400' };
              return (
                <div key={role} className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                  <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${colorSet.from} text-white shadow-lg`}>
                    <colorSet.icon className="h-5 w-5" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{count}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{role}</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }} transition={{ duration: 0.5 }}
                      className={`h-full rounded-full bg-gradient-to-r ${colorSet.from}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Member productivity */}
      <Panel title="Member productivity" description="Completion rate per member" className="mt-6">
        <div className="space-y-4">
          {analytics.memberProductivity.map((mp, idx) => (
            <div key={mp.name} className="flex items-center gap-4">
              <span className="w-28 text-xs font-bold text-slate-600 dark:text-slate-400 truncate">{mp.name}</span>
              <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${mp.rate}%` }} transition={{ duration: 0.6, delay: idx * 0.06 }}
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400" style={{ minWidth: mp.rate ? '20px' : 0 }} />
              </div>
              <span className="w-16 text-right text-xs font-bold text-slate-700 dark:text-slate-300">{mp.completed}/{mp.total}</span>
            </div>
          ))}
          {analytics.memberProductivity.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-4">No tasks assigned yet.</p>
          )}
        </div>
      </Panel>

      {/* Pipeline overview */}
      <Panel title="Workflow pipeline" description="End-to-end metrics: upload → summary → tasks → completion" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Meetings uploaded', value: analytics.totalMeetings, icon: FiFileText, color: 'bg-blue-50 text-blue-600' },
            { label: 'AI summaries ready', value: analytics.completedMeetings, icon: FiZap, color: 'bg-primary-50 text-primary-600' },
            { label: 'Tasks extracted', value: analytics.totalTasks, icon: FiCheckCircle, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Overdue items', value: analytics.overdueTasks, icon: FiCalendar, color: analytics.overdueTasks ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600' },
          ].map((stat) => (
            <motion.div key={stat.label} whileHover={{ y: -2 }}
              className="flex items-center gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 dark:border-slate-800 dark:bg-[#17212c]">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
              <div><p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p><p className="text-xs text-slate-500">{stat.label}</p></div>
            </motion.div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}

/* Employee analytics — simplified team overview */
function EmployeeAnalyticsContent({ user, analytics, activeWorkspace, selectWorkspace, myWorkspaces, activeWorkspaceId }) {
  return (
    <AppShell user={user} eyebrow={activeWorkspace?.name || 'Analytics'} title="Team overview"
      description="Quick performance metrics"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Team members" value={analytics.activeUsers} detail="Active members" icon={FiUsers} tone="blue" />
        <StatCard label="Avg progress" value={`${analytics.avgProgress}%`} detail="Completion rate" icon={FiTrendingUp} tone="green" />
        <StatCard label="Tasks" value={analytics.totalTasks} detail={`${analytics.completedTasks} completed`} icon={FiCheckCircle} tone="slate" />
        <StatCard label="Meetings" value={analytics.totalMeetings} detail="Uploaded" icon={FiFileText} tone="amber" />
      </div>
    </AppShell>
  );
}

/* Manager analytics */
function ManagerAnalyticsContent({ user, analytics, activeWorkspace, selectWorkspace, myWorkspaces, activeWorkspaceId }) {
  if (!analytics) return null;
  const maxPriority = Math.max(...Object.values(analytics.priorityDist), 1);

  return (
    <AppShell user={user} eyebrow={activeWorkspace?.name || 'Analytics'} title="Performance & metrics"
      description="Understand team velocity, task distribution, and productivity trends."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Avg progress" value={`${analytics.avgProgress}%`} detail="Completion rate" icon={FiTrendingUp} tone="blue" />
        <StatCard label="Completed" value={analytics.completedTasks} detail="Closed tasks" icon={FiCheckCircle} tone="green" />
        <StatCard label="In progress" value={analytics.inProgressTasks} detail="Active items" icon={FiBarChart2} tone="amber" />
        <StatCard label="Overdue rate" value={`${analytics.totalTasks ? Math.round((analytics.overdueTasks / analytics.totalTasks) * 100) : 0}%`}
          detail="Requires attention" icon={FiClock} tone={analytics.overdueTasks ? 'red' : 'slate'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Priority distribution" description="Task count by priority level">
          <div className="space-y-4">
            {[
              { key: 'URGENT', label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-600' },
              { key: 'HIGH', label: 'High', color: 'bg-orange-500', textColor: 'text-orange-600' },
              { key: 'MEDIUM', label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
              { key: 'LOW', label: 'Low', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-4">
                <span className={`w-16 text-xs font-bold ${item.textColor}`}>{item.label}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(analytics.priorityDist[item.key] / maxPriority) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${item.color}`}
                    style={{ minWidth: analytics.priorityDist[item.key] ? '20px' : 0 }} />
                </div>
                <span className="w-8 text-right text-sm font-bold text-slate-700 dark:text-slate-300">{analytics.priorityDist[item.key]}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Member productivity" description="Task completion rate per person">
          <div className="space-y-4">
            {analytics.memberProductivity.map((mp, idx) => (
              <motion.div key={mp.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{mp.name}</span>
                    <span className="text-xs font-bold text-slate-500">{mp.completed}/{mp.total} done</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${mp.rate}%` }} transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400" />
                  </div>
                </div>
                <span className="text-xs font-bold text-primary-600">{mp.rate}%</span>
              </motion.div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Summary" description="Quick department snapshot" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total meetings', value: analytics.totalMeetings, icon: FiCalendar },
            { label: 'Total tasks', value: analytics.totalTasks, icon: FiBriefcase },
            { label: 'Team members', value: analytics.activeUsers, icon: FiUsers },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <stat.icon className="h-6 w-6 text-primary-500" />
              <div><p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p><p className="text-xs text-slate-500">{stat.label}</p></div>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
