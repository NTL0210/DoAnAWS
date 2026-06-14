import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiSliders,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../../src/components/layout/AppShell';
import { getUsers, getTasks as getMockTasks, getDepartments } from '../../src/services/legacyDataService';

export default function AdminTasks() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ users: [], tasks: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [users, tasks, departments] = await Promise.all([
        getUsers(), getMockTasks(), getDepartments()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((u) => u.role === 'ADMIN');
      const currentUser = storedUser?.role === 'ADMIN' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setData({ users, tasks, departments });
      setLoading(false);
    };
    load();
  }, []);

  const enhanced = useMemo(() => {
    if (!data.tasks.length) return [];
    const userMap = data.users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    const deptMap = data.departments.reduce((acc, d) => { acc[d.id] = d; return acc; }, {});

    let list = data.tasks.map((t) => ({
      ...t,
      assigneeName: userMap[t.assigneeId]?.name || 'Unassigned',
      deptName: deptMap[t.departmentId]?.name || '—',
    }));

    if (filterStatus !== 'all') list = list.filter((t) => t.status === filterStatus);
    return list;
  }, [data, filterStatus]);

  if (loading || !user) return <LoadingState label="Loading tasks..." />;

  const total = data.tasks.length;
  const completed = data.tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgress = data.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const overdue = data.tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
  ).length;

  return (
    <AppShell
      user={user}
      eyebrow="Admin"
      title="All tasks"
      description="Company-wide task view across all departments."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tasks" value={total} detail="Across all departments" icon={FiBriefcase} tone="blue" />
        <StatCard label="Completed" value={completed} detail={`${total ? Math.round((completed / total) * 100) : 0}% completion`} icon={FiCheckCircle} tone="green" />
        <StatCard label="In progress" value={inProgress} detail="Actively worked on" icon={FiBarChart2} tone="amber" />
        <StatCard label="Overdue" value={overdue} detail="Needs attention" icon={FiAlertTriangle} tone={overdue ? 'red' : 'slate'} />
      </div>

      <Panel title={`Tasks (${enhanced.length})`} description="Filter by status to inspect" className="mt-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: total },
            { key: 'PENDING', label: 'Pending', count: data.tasks.filter((t) => t.status === 'PENDING').length },
            { key: 'IN_PROGRESS', label: 'In Progress', count: inProgress },
            { key: 'COMPLETED', label: 'Completed', count: completed },
          ].map((f) => (
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

        {enhanced.length === 0 ? (
          <EmptyState icon={FiCheckCircle} title="No tasks match" description="Try adjusting the filter." />
        ) : (
          <div className="space-y-2">
            {enhanced.map((task, idx) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="flex items-center gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] px-4 py-3 text-sm transition hover:border-primary-200 dark:border-slate-800 dark:bg-[#17212c]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</span>
                    <StatusPill tone={statusTone(task.status)}>{task.status.replace('_', ' ')}</StatusPill>
                    <StatusPill tone={priorityTone(task.priority)}>{task.priority}</StatusPill>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <FiUser className="h-3 w-3" />
                      {task.assigneeName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FiBriefcase className="h-3 w-3" />
                      {task.deptName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FiCalendar className="h-3 w-3" />
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
                    </span>
                  </div>
                </div>
                <div className="w-24 text-right">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary-600'}`}
                      style={{ width: `${task.progress || 0}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{task.progress || 0}%</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
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
