import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiLogIn,
  FiShield,
  FiUploadCloud,
  FiUserPlus,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, LoadingState } from '../../src/components/layout/AppShell';

const MOCK_LOGS = [
  { id: 'log-1', action: 'LOGIN_SUCCESS', message: 'Alex Johnson logged in', actor: 'Alex Johnson', timestamp: '2026-06-03T09:15:00Z', severity: 'info' },
  { id: 'log-2', action: 'MEETING_UPLOAD', message: 'Sarah Chen uploaded "Sprint Planning" transcript', actor: 'Sarah Chen', timestamp: '2026-06-02T14:30:00Z', severity: 'info' },
  { id: 'log-3', action: 'AI_PROCESSING', message: 'AI processing completed for "Sprint Planning"', actor: 'System', timestamp: '2026-06-02T14:32:00Z', severity: 'info' },
  { id: 'log-4', action: 'TASK_CREATED', message: '3 tasks auto-created from "Sprint Planning"', actor: 'AI System', timestamp: '2026-06-02T14:33:00Z', severity: 'info' },
  { id: 'log-5', action: 'USER_CREATED', message: 'Admin created user "Nguyen Van A"', actor: 'Alex Johnson', timestamp: '2026-06-01T11:00:00Z', severity: 'info' },
  { id: 'log-6', action: 'LOGIN_FAILED', message: 'Failed login attempt for john@company.com', actor: 'Unknown', timestamp: '2026-06-01T08:45:00Z', severity: 'warning' },
  { id: 'log-7', action: 'TASK_COMPLETED', message: 'John Doe completed "Implement form validation"', actor: 'John Doe', timestamp: '2026-05-30T16:20:00Z', severity: 'info' },
  { id: 'log-8', action: 'UNAUTHORIZED_ACCESS', message: 'Blocked unauthorized API access attempt', actor: 'System', timestamp: '2026-05-29T22:10:00Z', severity: 'error' },
  { id: 'log-9', action: 'DEPARTMENT_UPDATED', message: 'Frontend Team manager changed to Sarah Chen', actor: 'Alex Johnson', timestamp: '2026-05-28T15:00:00Z', severity: 'info' },
  { id: 'log-10', action: 'AI_PROCESSING_FAILED', message: 'AI processing failed for "Q3 Planning"', actor: 'System', timestamp: '2026-05-27T10:30:00Z', severity: 'error' },
];

const actionConfig = {
  LOGIN_SUCCESS: { icon: FiLogIn, color: 'bg-emerald-50 text-emerald-600' },
  MEETING_UPLOAD: { icon: FiUploadCloud, color: 'bg-blue-50 text-blue-600' },
  AI_PROCESSING: { icon: FiActivity, color: 'bg-primary-50 text-primary-600' },
  TASK_CREATED: { icon: FiCheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  USER_CREATED: { icon: FiUserPlus, color: 'bg-violet-50 text-violet-600' },
  LOGIN_FAILED: { icon: FiShield, color: 'bg-amber-50 text-amber-600' },
  TASK_COMPLETED: { icon: FiCheckCircle, color: 'bg-green-50 text-green-600' },
  UNAUTHORIZED_ACCESS: { icon: FiAlertTriangle, color: 'bg-red-50 text-red-600' },
  DEPARTMENT_UPDATED: { icon: FiFileText, color: 'bg-slate-50 text-slate-600' },
  AI_PROCESSING_FAILED: { icon: FiAlertTriangle, color: 'bg-red-50 text-red-600' },
};

const severityTone = {
  info: 'text-slate-500',
  warning: 'text-amber-600',
  error: 'text-red-600',
};

export default function AdminLogs() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [logs] = useState(MOCK_LOGS);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = { id: 'emp-1', name: 'Alex Johnson', role: 'ADMIN', avatar: 'https://i.pravatar.cc/150?img=1' };
      const currentUser = storedUser?.role === 'ADMIN' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !user) return <LoadingState label="Loading audit logs..." />;

  const filtered = filterSeverity === 'all' ? logs : logs.filter((l) => l.severity === filterSeverity);
  const errorCount = logs.filter((l) => l.severity === 'error').length;
  const warningCount = logs.filter((l) => l.severity === 'warning').length;

  return (
    <AppShell
      user={user}
      eyebrow="Admin"
      title="Audit logs"
      description={`${logs.length} events · ${errorCount} errors · ${warningCount} warnings`}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total events" value={logs.length} detail="All logged actions" icon={FiActivity} tone="blue" />
        <StatCard label="Errors" value={errorCount} detail="Requires review" icon={FiAlertTriangle} tone={errorCount ? 'red' : 'slate'} />
        <StatCard label="Warnings" value={warningCount} detail="Non-critical issues" icon={FiShield} tone={warningCount ? 'amber' : 'slate'} />
        <StatCard label="Info" value={logs.filter((l) => l.severity === 'info').length} detail="Routine events" icon={FiFileText} tone="green" />
      </div>

      <Panel title="Event timeline" description="Recent security and activity events" className="mt-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: logs.length },
            { key: 'info', label: 'Info', count: logs.filter((l) => l.severity === 'info').length },
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
                    <span className={`text-[10px] font-bold uppercase ${severityTone[log.severity]}`}>
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
      </Panel>
    </AppShell>
  );
}
