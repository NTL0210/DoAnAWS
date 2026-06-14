import { useEffect, useMemo, useState } from 'react';
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
  FiSliders,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../../src/components/layout/AppShell';
import { getUsers, getTasks as getMockTasks, getMeetings } from '../../src/services/legacyDataService';

export default function ManagerTasks() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ users: [], tasks: [], meetings: [] });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [users, tasks, meetings] = await Promise.all([
        getUsers(), getMockTasks(), getMeetings()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((u) => u.role === 'MANAGER');
      const currentUser = storedUser?.role === 'MANAGER' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setData({ users, tasks, meetings });
      setLoading(false);
    };
    load();
  }, []);

  const dashboard = useMemo(() => {
    if (!user) return null;
    const deptTasks = data.tasks.filter((t) => t.departmentId === user.departmentId);
    const completed = deptTasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgress = deptTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const pending = deptTasks.filter((t) => t.status === 'PENDING').length;
    const overdue = deptTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length;

    let filtered = [...deptTasks];
    if (filterStatus !== 'all') filtered = filtered.filter((t) => t.status === filterStatus);
    if (filterPriority !== 'all') filtered = filtered.filter((t) => t.priority === filterPriority);
    filtered.sort((a, b) => {
      if (sortBy === 'priority') return priorityRank(b.priority) - priorityRank(a.priority);
      if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
      return new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01');
    });

    const userMap = data.users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    const meetingMap = data.meetings.reduce((acc, m) => { acc[m.id] = m; return acc; }, {});

    return { deptTasks, completed, inProgress, pending, overdue, filtered, userMap, meetingMap };
  }, [user, data, filterStatus, filterPriority, sortBy]);

  if (loading || !dashboard || !user) return <LoadingState label="Loading team tasks..." />;

  const statusFilters = [
    { key: 'all', label: 'All', count: dashboard.deptTasks.length },
    { key: 'PENDING', label: 'Pending', count: dashboard.pending },
    { key: 'IN_PROGRESS', label: 'In Progress', count: dashboard.inProgress },
    { key: 'COMPLETED', label: 'Completed', count: dashboard.completed },
  ];

  return (
    <AppShell
      user={user}
      eyebrow="Task management"
      title="Team tasks"
      description="Monitor, filter, and manage all tasks across your department."
      actions={
        <Link href="/workspace?view=meetings" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700">
          <FiFileText className="h-4 w-4" />
          Upload meeting
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tasks" value={dashboard.deptTasks.length} detail="All department tasks" icon={FiBriefcase} tone="blue" />
        <StatCard label="Pending" value={dashboard.pending} detail="Waiting to start" icon={FiClock} tone="slate" />
        <StatCard label="In progress" value={dashboard.inProgress} detail="Actively moving" icon={FiBarChart2} tone="amber" />
        <StatCard label="Overdue" value={dashboard.overdue} detail="Needs attention" icon={FiAlertTriangle} tone={dashboard.overdue ? 'red' : 'slate'} />
      </div>

      <Panel title={`Tasks (${dashboard.filtered.length})`} description="Filtered by status and priority" className="mt-6">
        {/* Filters */}
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FiSliders className="h-4 w-4 text-slate-400" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-[#fbfcfe] px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">All priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
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

        {/* Task list */}
        {dashboard.filtered.length === 0 ? (
          <EmptyState
            icon={FiCheckCircle}
            title="No tasks match"
            description="Try adjusting your filters."
          />
        ) : (
          <div className="grid gap-3">
            {dashboard.filtered.map((task, idx) => {
              const assignee = dashboard.userMap[task.assigneeId];
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
                  transition={{ delay: idx * 0.03 }}
                  className="rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-[#17212c]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={getStatusTone(task.status)}>{task.status.replace('_', ' ')}</StatusPill>
                        <StatusPill tone={getPriorityTone(task.priority)}>{task.priority}</StatusPill>
                        {overdue && <StatusPill tone="red">OVERDUE</StatusPill>}
                      </div>
                      <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{task.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{task.description}</p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <FiUser className="h-3.5 w-3.5" />
                          {assignee?.name || 'Unassigned'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <FiCalendar className="h-3.5 w-3.5" />
                          {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <FiFileText className="h-3.5 w-3.5" />
                          {meeting?.title || 'Manual task'}
                        </span>
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

function priorityRank(p) {
  return { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[p] || 0;
}
function getStatusTone(s) {
  if (s === 'COMPLETED') return 'green';
  if (s === 'IN_PROGRESS') return 'blue';
  if (s === 'PENDING') return 'amber';
  if (s === 'OVERDUE') return 'red';
  return 'slate';
}
function getPriorityTone(p) {
  if (p === 'URGENT' || p === 'HIGH') return 'red';
  if (p === 'MEDIUM') return 'amber';
  return 'green';
}
