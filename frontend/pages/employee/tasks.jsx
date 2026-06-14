import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiLoader,
  FiSliders,
  FiTarget,
  FiUser,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../../src/components/layout/AppShell';
import { getTasks as getMockTasks, getMeetings } from '../../src/services/legacyDataService';

export default function EmployeeTasks() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ tasks: [], meetings: [] });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [tasks, meetings] = await Promise.all([
        getMockTasks(), getMeetings()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = { id: 'emp-3', name: 'John Doe', email: 'john@company.com', role: 'EMPLOYEE', departmentId: 'dept-1' };
      const currentUser = storedUser?.role === 'EMPLOYEE' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setData({ tasks, meetings });
      setLoading(false);
    };
    load();
  }, []);

  const dashboard = useMemo(() => {
    if (!user) return null;

    const myTasks = data.tasks.filter((t) => t.assigneeId === user.id);
    const meetingMap = data.meetings.reduce((acc, m) => { acc[m.id] = m; return acc; }, {});

    const pending = myTasks.filter((t) => t.status === 'PENDING').length;
    const inProgress = myTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const completed = myTasks.filter((t) => t.status === 'COMPLETED').length;
    const overdue = myTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length;

    let filtered = [...myTasks];
    if (filterStatus !== 'all') filtered = filtered.filter((t) => t.status === filterStatus);
    filtered.sort((a, b) => {
      if (sortBy === 'priority') return priorityRank(b.priority) - priorityRank(a.priority);
      if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
      return new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01');
    });

    return { myTasks, meetingMap, pending, inProgress, completed, overdue, filtered };
  }, [user, data, filterStatus, sortBy]);

  if (loading || !dashboard || !user) return <LoadingState label="Loading your tasks..." />;

  const statusFilters = [
    { key: 'all', label: 'All', count: dashboard.myTasks.length },
    { key: 'PENDING', label: 'Pending', count: dashboard.pending },
    { key: 'IN_PROGRESS', label: 'In Progress', count: dashboard.inProgress },
    { key: 'COMPLETED', label: 'Completed', count: dashboard.completed },
  ];

  return (
    <AppShell
      user={user}
      eyebrow="Employee workspace"
      title="My tasks"
      description="View and manage your assigned tasks, deadlines, and progress."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My tasks" value={dashboard.myTasks.length} detail="Total assigned" icon={FiTarget} tone="blue" />
        <StatCard label="Pending" value={dashboard.pending} detail="Waiting to start" icon={FiClock} tone="slate" />
        <StatCard label="In progress" value={dashboard.inProgress} detail="Currently active" icon={FiLoader} tone="amber" />
        <StatCard label="Completed" value={dashboard.completed} detail="Closed successfully" icon={FiCheckCircle} tone="green" />
      </div>

      <Panel title={`Tasks (${dashboard.filtered.length})`} description="Filter and sort your workload" className="mt-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterStatus(f.key)}
                className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                  filterStatus === f.key
                    ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950'
                    : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <FiSliders className="h-4 w-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-[#fbfcfe] px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="deadline">Sort: Deadline</option>
              <option value="priority">Sort: Priority</option>
              <option value="progress">Sort: Progress</option>
            </select>
          </div>
        </div>

        {dashboard.filtered.length === 0 ? (
          <EmptyState
            icon={FiCheckCircle}
            title="No tasks found"
            description="Nothing matches your filters."
          />
        ) : (
          <div className="space-y-3">
            {dashboard.filtered.map((task, idx) => {
              const meeting = dashboard.meetingMap[task.meetingId];
              const overdue =
                task.deadline &&
                new Date(task.deadline) < new Date() &&
                task.status !== 'COMPLETED';

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-[#17212c]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={statusTone(task.status)}>
                          {task.status.replace('_', ' ')}
                        </StatusPill>
                        <StatusPill tone={priorityTone(task.priority)}>
                          {task.priority}
                        </StatusPill>
                        {overdue && <StatusPill tone="red">OVERDUE</StatusPill>}
                      </div>
                      <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
                        {task.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                        {task.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <FiCalendar className="h-3.5 w-3.5" />
                          {task.deadline
                            ? new Date(task.deadline).toLocaleDateString()
                            : 'No deadline'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <FiClock className="h-3.5 w-3.5" />
                          {task.progress || 0}% complete
                        </span>
                        {meeting && (
                          <span className="inline-flex items-center gap-1.5">
                            <FiCalendar className="h-3.5 w-3.5" />
                            {meeting.title}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full lg:w-44">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Progress</span>
                        <span>{task.progress || 0}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary-600'
                          }`}
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[#fbfcfe] text-sm font-bold text-slate-700 transition hover:bg-white hover:shadow-sm active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <FiEye className="h-4 w-4" />
                        Update status
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Overdue alert */}
      {dashboard.overdue > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">
            <FiClock className="h-4 w-4" />
          </span>
          You have {dashboard.overdue} overdue task{dashboard.overdue > 1 ? 's' : ''} that need{dashboard.overdue === 1 ? 's' : ''} your attention.
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
