import { useEffect, useState } from 'react';
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
} from 'react-icons/fi';
import AppShell, { Panel, StatusPill, LoadingState } from '../../src/components/layout/AppShell';

/**
 * Reusable toggle switch component.
 */
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
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = { id: 'emp-1', name: 'Alex Johnson', role: 'ADMIN', avatar: 'https://i.pravatar.cc/150?img=1' };
      const currentUser = storedUser?.role === 'ADMIN' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 250));
      setUser(currentUser);
      setLoading(false);
    };
    load();
  }, []);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (section) => {
    setSaved(section);
    setTimeout(() => setSaved(null), 2000);
  };

  if (loading || !user) return <LoadingState label="Loading settings..." />;

  return (
    <AppShell
      user={user}
      eyebrow="Admin"
      title="System settings"
      description="Configure platform behavior, notifications, and defaults."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {/* General settings */}
        <Panel title="General" description="Basic platform configuration">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
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
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
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
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
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
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
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

        {/* Notifications */}
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

        {/* System info */}
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

        {/* Security */}
        <Panel title="Security" description="Access and audit configuration">
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <FiShield className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">All systems secure</p>
                <p className="text-xs text-slate-500">No security incidents reported</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <FiLock className="h-8 w-8 text-primary-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">JWT authentication active</p>
                <p className="text-xs text-slate-500">Role-based access control enabled</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <FiGlobe className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Audit logging</p>
                <p className="text-xs text-slate-500">All actions are recorded</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
