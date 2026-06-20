import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiUserPlus,
} from 'react-icons/fi';
import AppShell, { Panel, StatusPill, LoadingState, EmptyState } from '../src/components/layout/AppShell';

const MOCK_NOTIFICATIONS = [
  { id: 'n1', title: 'New task assigned', message: 'You have been assigned: Implement form validation for login page', type: 'task_assigned', isRead: false, createdAt: '2026-05-21T10:30:00Z' },
  { id: 'n2', title: 'Task deadline approaching', message: 'Your task "Create reusable input components" is due in 2 days', type: 'deadline_approaching', isRead: false, createdAt: '2026-06-01T14:20:00Z' },
  { id: 'n3', title: 'Meeting processed', message: 'The Weekly Sync meeting has been processed. 3 tasks extracted.', type: 'meeting_processed', isRead: false, createdAt: '2026-05-22T09:15:00Z' },
  { id: 'n4', title: 'Task completed', message: 'You marked "Review designs" as completed.', type: 'task_completed', isRead: true, createdAt: '2026-05-25T16:00:00Z' },
  { id: 'n5', title: 'New comment', message: 'Sarah added a note to your task "Implement form validation"', type: 'comment', isRead: true, createdAt: '2026-05-23T11:20:00Z' },
];

const typeConfig = {
  task_assigned: { icon: FiUserPlus, color: 'bg-blue-50 text-blue-600', label: 'Assignment' },
  deadline_approaching: { icon: FiClock, color: 'bg-amber-50 text-amber-600', label: 'Deadline' },
  meeting_processed: { icon: FiFileText, color: 'bg-primary-50 text-primary-600', label: 'Meeting' },
  task_completed: { icon: FiCheckCircle, color: 'bg-emerald-50 text-emerald-600', label: 'Completed' },
  comment: { icon: FiBell, color: 'bg-slate-50 text-slate-600', label: 'Note' },
};

export default function EmployeeNotifications() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = {
        id: 'emp-3',
        name: 'John Doe',
        email: 'john@company.com',
        role: 'EMPLOYEE',
        departmentId: 'dept-1',
        avatar: 'https://i.pravatar.cc/150?img=3',
      };
      const currentUser = storedUser?.role === 'EMPLOYEE' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setNotifications(MOCK_NOTIFICATIONS);
      setLoading(false);
    };
    load();
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const toggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
  };

  if (loading || !user) return <LoadingState label="Loading notifications..." />;

  const filtered =
    filter === 'all'
      ? notifications
      : filter === 'unread'
        ? notifications.filter((n) => !n.isRead)
        : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AppShell
      user={user}
      eyebrow="Notifications"
      title="Activity & alerts"
      description={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
      actions={
        unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-[#fbfcfe] px-4 text-sm font-bold text-slate-700 transition hover:bg-white hover:shadow-sm active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FiCheckCircle className="h-4 w-4" />
            Mark all read
          </button>
        )
      }
    >
      <Panel title={`Notifications (${filtered.length})`} description="Stay updated on tasks, meetings, and activity">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                filter === f.key
                  ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={FiBell}
            title="All caught up!"
            description="No notifications match your filter."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((n, idx) => {
              const config = typeConfig[n.type] || typeConfig.task_assigned;
              return (
                <motion.button
                  key={n.id}
                  type="button"
                  onClick={() => toggleRead(n.id)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`flex w-full items-start gap-4 rounded-lg border border-slate-200/80 p-4 text-left transition hover:border-primary-200 hover:shadow-sm ${
                    !n.isRead
                      ? 'bg-primary-50/40 dark:bg-primary-900/10'
                      : 'bg-[#fbfcfe] dark:bg-[#17212c]'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${config.color}`}
                  >
                    <config.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {n.title}
                      </h3>
                      {!n.isRead && (
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.message}</p>
                    <p className="mt-1.5 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
