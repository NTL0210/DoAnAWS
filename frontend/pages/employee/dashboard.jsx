import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiLoader, FiTarget } from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill } from '../../src/components/layout/AppShell';
import { getUsers, getTasks as getMockTasks, getMeetings } from '../../src/services/legacyDataService';
import TaskList from '../../src/components/tasks/TaskList';

export default function EmployeeDashboard() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ users: [], tasks: [], meetings: [] });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      const [users, tasks, meetings] = await Promise.all([
        getUsers(), getMockTasks(), getMeetings()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((item) => item.role === 'EMPLOYEE');
      const currentUser = storedUser?.role === 'EMPLOYEE' ? { ...fallback, ...storedUser } : fallback;

      await new Promise((resolve) => setTimeout(resolve, 350));
      setUser(currentUser);
      setData({ users, tasks, meetings });
      setLoading(false);
    };

    loadDashboard();
  }, []);

  const dashboard = useMemo(() => {
    if (!user) return null;

    const myTasks = data.tasks.filter((task) => task.assigneeId === user.id);
    const pending = myTasks.filter((task) => task.status === 'PENDING').length;
    const inProgress = myTasks.filter((task) => task.status === 'IN_PROGRESS').length;
    const completed = myTasks.filter((task) => task.status === 'COMPLETED').length;
    const overdue = myTasks.filter((task) => task.deadline && new Date(task.deadline) < new Date() && task.status !== 'COMPLETED').length;
    const avgProgress = myTasks.length ? Math.round(myTasks.reduce((sum, task) => sum + task.progress, 0) / myTasks.length) : 0;
    const nextTask = [...myTasks]
      .filter((task) => task.status !== 'COMPLETED')
      .sort((a, b) => new Date(a.deadline || '2999-01-01') - new Date(b.deadline || '2999-01-01'))[0];

    return { myTasks, pending, inProgress, completed, overdue, avgProgress, nextTask };
  }, [data.tasks, user]);

  if (loading || !dashboard || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] dark:bg-[#101820]">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Loading employee workspace...</p>
        </div>
      </div>
    );
  }

  const filters = [
    { key: 'all', label: 'All', count: dashboard.myTasks.length },
    { key: 'PENDING', label: 'Pending', count: dashboard.pending },
    { key: 'IN_PROGRESS', label: 'In progress', count: dashboard.inProgress },
    { key: 'COMPLETED', label: 'Completed', count: dashboard.completed },
  ];

  return (
    <AppShell
      user={user}
      eyebrow="Employee workspace"
      title="My task board"
      description="Focus on what is assigned to you, what is due soon, and what is already complete."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My tasks" value={dashboard.myTasks.length} detail={`${dashboard.avgProgress}% average progress`} icon={FiTarget} tone="blue" />
        <StatCard label="Pending" value={dashboard.pending} detail="Waiting to start" icon={FiClock} tone="amber" />
        <StatCard label="In progress" value={dashboard.inProgress} detail="Currently active" icon={FiLoader} tone="blue" />
        <StatCard label="Completed" value={dashboard.completed} detail="Closed successfully" icon={FiCheckCircle} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel title="Next focus" description="The most urgent open task.">
          {dashboard.nextTask ? (
            <div className="rounded-lg bg-[#172033] p-5 text-white dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <StatusPill tone={dashboard.overdue ? 'red' : 'amber'}>{dashboard.nextTask.priority}</StatusPill>
                  <h2 className="mt-4 text-lg font-bold">{dashboard.nextTask.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{dashboard.nextTask.description}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between text-sm text-slate-300">
                <span>{dashboard.nextTask.deadline ? new Date(dashboard.nextTask.deadline).toLocaleDateString() : 'No deadline'}</span>
                <span>{dashboard.nextTask.progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${dashboard.nextTask.progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-[#f4f7fb] p-6 text-center dark:border-slate-700 dark:bg-slate-900">
              <FiCheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">No open tasks. Nice and tidy.</p>
            </div>
          )}

          {dashboard.overdue > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <FiAlertTriangle className="h-4 w-4" />
              {dashboard.overdue} overdue task needs attention
            </div>
          )}
        </Panel>

        <Panel title="Task list" description="Filter by status and scan progress quickly.">
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveFilter(item.key)}
                className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                  activeFilter === item.key
                    ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950'
                    : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>
          <TaskList filters={{ assigneeId: user.id, status: activeFilter === 'all' ? undefined : activeFilter }} compact />
        </Panel>
      </div>
    </AppShell>
  );
}
