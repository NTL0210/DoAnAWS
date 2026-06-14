import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCalendar, FiCheckCircle, FiClock, FiEye, FiLoader, FiSliders, FiUser } from 'react-icons/fi';
import { StatusPill } from '../layout/AppShell';
import { getTasks, getUsers } from '../../services/legacyDataService';

export default function TaskList({ filters = {}, compact = false }) {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      const [allTasks, allUsers] = await Promise.all([
        getTasks(), getUsers()
      ]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setTasks(allTasks);
      setUsers(allUsers);
      setLoading(false);
    };

    loadTasks();
  }, []);

  const visibleTasks = useMemo(() => {
    let nextTasks = [...tasks];

    if (filters.departmentId) nextTasks = nextTasks.filter((task) => task.departmentId === filters.departmentId);
    if (filters.assigneeId) nextTasks = nextTasks.filter((task) => task.assigneeId === filters.assigneeId);
    if (filters.status) nextTasks = nextTasks.filter((task) => task.status === filters.status);
    if (filters.priority) nextTasks = nextTasks.filter((task) => task.priority === filters.priority);
    if (filters.meetingId) nextTasks = nextTasks.filter((task) => task.meetingId === filters.meetingId);
    if (!filters.status && localStatus !== 'all') nextTasks = nextTasks.filter((task) => task.status === localStatus);

    return nextTasks.sort((a, b) => {
      if (sortBy === 'priority') return priorityRank(b.priority) - priorityRank(a.priority);
      if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
      return new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01');
    });
  }, [filters, localStatus, sortBy, tasks]);

  useEffect(() => {
    setVisibleCount(50);
  }, [filters, localStatus, sortBy]);

  const renderedTasks = useMemo(() => visibleTasks.slice(0, visibleCount), [visibleTasks, visibleCount]);

  const userById = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});
  }, [users]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-[#eef3f8] dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
    );
  }

  if (visibleTasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-[#eef3f8] p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <FiCheckCircle className="mx-auto h-9 w-9 text-emerald-500" />
        <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">No tasks found</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nothing matches the current filters.</p>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'rounded-lg border border-slate-200/80 bg-[#fbfcfe] shadow-sm dark:border-slate-800 dark:bg-[#17212c]'}>
      {!compact && (
        <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Tasks ({visibleTasks.length})</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Prioritized by deadline, status, and ownership.</p>
          </div>
          <Controls localStatus={localStatus} setLocalStatus={setLocalStatus} sortBy={sortBy} setSortBy={setSortBy} />
        </div>
      )}

      {compact && (
        <div className="mb-4 flex justify-end">
          <Controls localStatus={localStatus} setLocalStatus={setLocalStatus} sortBy={sortBy} setSortBy={setSortBy} hideStatus />
        </div>
      )}

      <div className={compact ? 'space-y-3' : 'divide-y divide-slate-200/80 dark:divide-slate-800'}>
        {renderedTasks.map((task, index) => {
          const assignee = userById[task.assigneeId];
          const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'COMPLETED';

          return (
            <motion.article
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035 }}
              className={`${compact ? 'rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 dark:border-slate-800 dark:bg-[#17212c]' : 'p-5'} transition hover:bg-[#f4f7fb] dark:hover:bg-slate-800/70`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={getStatusTone(task.status)}>{task.status.replace('_', ' ')}</StatusPill>
                    <StatusPill tone={getPriorityTone(task.priority)}>{task.priority}</StatusPill>
                    {overdue && <StatusPill tone="red">OVERDUE</StatusPill>}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">{task.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{task.description}</p>

                  <div className="mt-4 grid gap-3 text-xs font-semibold text-slate-500 sm:grid-cols-3 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <FiUser className="h-4 w-4 text-slate-400" />
                      {assignee?.name || 'Unassigned'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <FiCalendar className="h-4 w-4 text-slate-400" />
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <FiClock className="h-4 w-4 text-slate-400" />
                      {task.progress || 0}% progress
                    </span>
                  </div>
                </div>

                <div className="w-full lg:w-48">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span>Progress</span>
                    <span>{task.progress || 0}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary-600'}`}
                      style={{ width: `${task.progress || 0}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[#fbfcfe] text-sm font-bold text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FiEye className="h-4 w-4" />
                    Details
                  </button>
                </div>
              </div>
            </motion.article>
          );
        })}
        {visibleTasks.length > visibleCount && (
          <div className={compact ? 'pt-1' : 'p-5'}>
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 50)}
              className="w-full rounded-lg border border-slate-200 bg-[#fbfcfe] px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Load 50 more tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Controls({ localStatus, setLocalStatus, sortBy, setSortBy, hideStatus = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FiSliders className="hidden h-4 w-4 text-slate-400 sm:block" />
      {!hideStatus && (
        <select
          value={localStatus}
          onChange={(event) => setLocalStatus(event.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-[#fbfcfe] px-3 text-sm font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-primary-950"
        >
          <option value="all">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      )}
      <select
        value={sortBy}
        onChange={(event) => setSortBy(event.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-[#fbfcfe] px-3 text-sm font-semibold text-slate-700 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-primary-950"
      >
        <option value="deadline">Deadline</option>
        <option value="priority">Priority</option>
        <option value="progress">Progress</option>
      </select>
    </div>
  );
}

function getStatusTone(status) {
  if (status === 'COMPLETED') return 'green';
  if (status === 'IN_PROGRESS') return 'blue';
  if (status === 'PENDING') return 'amber';
  if (status === 'OVERDUE') return 'red';
  return 'slate';
}

function getPriorityTone(priority) {
  if (priority === 'URGENT' || priority === 'HIGH') return 'red';
  if (priority === 'MEDIUM') return 'amber';
  return 'green';
}

function priorityRank(priority) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 }[priority] || 0;
}
