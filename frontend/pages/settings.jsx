import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiBell,
  FiCheckCircle,
  FiGlobe,
  FiLoader,
  FiLock,
  FiMail,
  FiSave,
  FiShield,
  FiSliders,
  FiToggleLeft,
  FiUser,
  FiBriefcase,
  FiChevronDown,
} from 'react-icons/fi';
import AppShell, { Panel, StatusPill, LoadingState } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-100 ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const {
    currentUser, loading, workspaces,
    activeWorkspace, activeWorkspaceId, selectWorkspace,
    workspaceRole,
  } = useWorkspace();
  const [showWsPicker, setShowWsPicker] = useState(false);
  const [saved, setSaved] = useState(null);
  const [settings, setSettings] = useState({
    siteName: 'AI Meeting Workforce',
    allowRegistration: true,
    autoAssignTasks: true,
    notifyOnComplete: true,
    notifyOnOverdue: true,
    processingTimeout: '5',
    maxUploadSize: '50',
  });

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

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (section) => {
    setSaved(section);
    setTimeout(() => setSaved(null), 2000);
  };

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
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a workspace to configure.</p>
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
            You need the Owner role in <strong>{activeWorkspace.name}</strong> to access settings.
          </p>
          <Link href="/workspace" className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Go to Workspace</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      user={user}
      eyebrow={activeWorkspace?.name || 'Admin'}
      title="Workspace settings"
      description="Configure platform behavior, notifications, and defaults."
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="General" description="Basic platform configuration">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Site name
              </label>
              <input
                value={settings.siteName}
                onChange={(e) => update('siteName', e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  AI timeout (min)
                </label>
                <select
                  value={settings.processingTimeout}
                  onChange={(e) => update('processingTimeout', e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="1">1 minute</option>
                  <option value="3">3 minutes</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Max upload (MB)
                </label>
                <select
                  value={settings.maxUploadSize}
                  onChange={(e) => update('maxUploadSize', e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="10">10 MB</option>
                  <option value="25">25 MB</option>
                  <option value="50">50 MB</option>
                  <option value="100">100 MB</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Allow self-registration</span>
              <button
                type="button"
                onClick={() => update('allowRegistration', !settings.allowRegistration)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  settings.allowRegistration ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-100 ${
                  settings.allowRegistration ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSave('general')}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700 active:scale-95"
            >
              <FiSave className="h-4 w-4" />
              Save settings
            </button>
            {saved === 'general' && (
              <span className="ml-3 text-xs font-semibold text-emerald-600">
                <FiCheckCircle className="mr-1 inline h-3 w-3" />
                Saved
              </span>
            )}
          </div>
        </Panel>

        <Panel title="Notifications" description="Configure alert preferences">
          <div className="space-y-1">
            <Toggle label="Auto-assign tasks from AI" value={settings.autoAssignTasks} onChange={(v) => update('autoAssignTasks', v)} />
            <Toggle label="Notify on task completion" value={settings.notifyOnComplete} onChange={(v) => update('notifyOnComplete', v)} />
            <Toggle label="Alert on overdue tasks" value={settings.notifyOnOverdue} onChange={(v) => update('notifyOnOverdue', v)} />
            <div className="pt-4">
              <button
                type="button"
                onClick={() => handleSave('notifications')}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700 active:scale-95"
              >
                <FiSave className="h-4 w-4" />
                Save preferences
              </button>
              {saved === 'notifications' && (
                <span className="ml-3 text-xs font-semibold text-emerald-600">
                  <FiCheckCircle className="mr-1 inline h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="System information" description="Platform version and status">
          <div className="space-y-4">
            {[
              { label: 'Platform version', value: 'v0.1.0 MVP' },
              { label: 'Frontend', value: 'Next.js 13 + React 18' },
              { label: 'Backend', value: 'Node.js (mock API)' },
              { label: 'Database', value: 'DynamoDB (mock)' },
              { label: 'AI Engine', value: 'Mock AI (GPT-ready)' },
              { label: 'Auth', value: 'Local JWT (Cognito-ready)' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Security" description="Access and audit configuration">
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <FiShield className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">All systems secure</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">No security incidents reported</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <FiLock className="h-8 w-8 text-primary-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">JWT authentication active</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Role-based access control enabled</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <FiGlobe className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Audit logging</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">All actions are recorded</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
