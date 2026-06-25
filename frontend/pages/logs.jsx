import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiLock,
  FiLogIn,
  FiShield,
  FiUploadCloud,
  FiUserPlus,
  FiBriefcase,
  FiChevronDown,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, LoadingState } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';

const actionConfig = {
  LOGIN_SUCCESS: { icon: FiLogIn, color: 'bg-emerald-50 text-emerald-600' },
  MEETING_UPLOAD: { icon: FiUploadCloud, color: 'bg-blue-50 text-blue-600' },
  AI_PROCESSING: { icon: FiActivity, color: 'bg-primary-50 text-primary-600' },
  TASK_CREATED: { icon: FiCheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  USER_CREATED: { icon: FiUserPlus, color: 'bg-violet-50 text-violet-600' },
  LOGIN_FAILED: { icon: FiShield, color: 'bg-amber-50 text-amber-600' },
  TASK_COMPLETED: { icon: FiCheckCircle, color: 'bg-green-50 text-green-600' },
  UNAUTHORIZED_ACCESS: { icon: FiAlertTriangle, color: 'bg-red-50 text-red-600' },
  WORKSPACE_UPDATED: { icon: FiFileText, color: 'bg-slate-50 text-slate-600' },
  AI_PROCESSING_FAILED: { icon: FiAlertTriangle, color: 'bg-red-50 text-red-600' },
};

const severityTone = {
  info: 'text-slate-500',
  warning: 'text-amber-600',
  error: 'text-red-600',
};

export default function AdminLogs() {
  const {
    currentUser, loading: ctxLoading, workspaces,
    activeWorkspace, activeWorkspaceId, selectWorkspace,
    workspaceRole, activityFeed,
  } = useWorkspace();
  const [showWsPicker, setShowWsPicker] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('all');

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

  const scopedLogs = useMemo(() => {
    if (!activeWorkspace || !activityFeed) return [];
    const feed = activityFeed[activeWorkspace.id];
    if (!feed || !Array.isArray(feed)) return [];
    return feed.map((entry) => ({
      id: entry.id,
      action: entry.action || entry.type || 'INFO',
      message: entry.message || entry.content || '',
      actor: entry.actor || entry.userName || 'System',
      timestamp: entry.timestamp || entry.createdAt || new Date().toISOString(),
      severity: entry.severity || 'info',
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [activeWorkspace, activityFeed]);

  const loading = ctxLoading;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading...</p>
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
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a workspace to view its activity log.</p>
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
            You need the Owner role in <strong>{activeWorkspace.name}</strong> to view audit logs.
          </p>
          <Link href="/workspace" className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Go to Workspace</Link>
        </div>
      </AppShell>
    );
  }

  const filtered = filterSeverity === 'all' ? scopedLogs : scopedLogs.filter((l) => l.severity === filterSeverity);
  const errorCount = scopedLogs.filter((l) => l.severity === 'error').length;
  const warningCount = scopedLogs.filter((l) => l.severity === 'warning').length;

  return (
    <AppShell
      user={user}
      eyebrow={activeWorkspace?.name || 'Admin'}
      title="Activity log"
      description={`${scopedLogs.length} events · ${errorCount} errors · ${warningCount} warnings`}
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
        <StatCard label="Total events" value={scopedLogs.length} detail="All logged actions" icon={FiActivity} tone="blue" />
        <StatCard label="Errors" value={errorCount} detail="Requires review" icon={FiAlertTriangle} tone={errorCount ? 'red' : 'slate'} />
        <StatCard label="Warnings" value={warningCount} detail="Non-critical issues" icon={FiShield} tone={warningCount ? 'amber' : 'slate'} />
        <StatCard label="Info" value={scopedLogs.filter((l) => l.severity === 'info').length} detail="Routine events" icon={FiFileText} tone="green" />
      </div>

      <Panel title="Event timeline" description="Recent workspace activity events" className="mt-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: scopedLogs.length },
            { key: 'info', label: 'Info', count: scopedLogs.filter((l) => l.severity === 'info').length },
            { key: 'warning', label: 'Warning', count: warningCount },
            { key: 'error', label: 'Error', count: errorCount },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterSeverity(f.key)}
              className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                filterSeverity === f.key
                  ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
            <FiActivity className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">No activity recorded yet</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Actions within this workspace will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((log, idx) => {
              const config = actionConfig[log.action] || { icon: FiActivity, color: 'bg-slate-50 text-slate-600' };
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="flex items-start gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] px-4 py-3 transition hover:border-primary-200 dark:border-slate-800 dark:bg-[#17212c]"
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${config.color}`}>
                    <config.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{log.message}</p>
                      <span className={`text-[10px] font-bold uppercase ${severityTone[log.severity] || 'text-slate-500'}`}>
                        {log.severity}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <FiClock className="h-3 w-3" />
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span>by {log.actor}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
