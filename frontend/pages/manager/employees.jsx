import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiMail,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../../src/components/layout/AppShell';
import { getUsers, getTasks as getMockTasks } from '../../src/services/legacyDataService';

export default function ManagerEmployees() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ users: [], tasks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [users, tasks] = await Promise.all([
        getUsers(), getMockTasks()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((u) => u.role === 'MANAGER');
      const currentUser = storedUser?.role === 'MANAGER' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setData({ users, tasks });
      setLoading(false);
    };
    load();
  }, []);

  const dashboard = useMemo(() => {
    if (!user) return null;
    const teamMembers = data.users.filter((u) => u.departmentId === user.departmentId && u.role !== 'MANAGER');
    const deptTasks = data.tasks.filter((t) => t.departmentId === user.departmentId);

    const workload = teamMembers.map((member) => {
      const tasks = deptTasks.filter((t) => t.assigneeId === member.id);
      return {
        ...member,
        taskCount: tasks.length,
        completed: tasks.filter((t) => t.status === 'COMPLETED').length,
        inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        overdue: tasks.filter(
          (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
        ).length,
        progress: tasks.length
          ? Math.round((tasks.filter((t) => t.status === 'COMPLETED').length / tasks.length) * 100)
          : 0,
      };
    });

    return { teamMembers: workload };
  }, [user, data]);

  if (loading || !dashboard || !user) return <LoadingState label="Loading employees..." />;

  const metrics = {
    total: dashboard.teamMembers.length,
    totalTasks: dashboard.teamMembers.reduce((s, m) => s + m.taskCount, 0),
    totalOverdue: dashboard.teamMembers.reduce((s, m) => s + m.overdue, 0),
    avgProgress: dashboard.teamMembers.length
      ? Math.round(dashboard.teamMembers.reduce((s, m) => s + m.progress, 0) / dashboard.teamMembers.length)
      : 0,
  };

  return (
    <AppShell
      user={user}
      eyebrow="People management"
      title="Team members"
      description={`${metrics.total} members across your department`}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Team members" value={metrics.total} detail="Active employees" icon={FiUsers} tone="blue" />
        <StatCard label="Total tasks" value={metrics.totalTasks} detail="Across all members" icon={FiCheckCircle} tone="green" />
        <StatCard label="Avg progress" value={`${metrics.avgProgress}%`} detail="Department average" icon={FiClock} tone="amber" />
        <StatCard label="Overdue tasks" value={metrics.totalOverdue} detail="Needs review" icon={FiCalendar} tone={metrics.totalOverdue ? 'red' : 'slate'} />
      </div>

      <Panel title="Employee workload" description="Task distribution and progress per member" className="mt-6">
        {dashboard.teamMembers.length === 0 ? (
          <EmptyState icon={FiUsers} title="No team members" description="Your department has no employees assigned." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.teamMembers.map((member, idx) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-lg border border-slate-200/80 bg-[#f4f7fb] p-4 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="h-12 w-12 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{member.name}</h3>
                    <p className="truncate text-xs text-slate-500">Employee</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-white/70 p-2 dark:bg-slate-800">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{member.taskCount}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Tasks</p>
                  </div>
                  <div className="rounded-md bg-white/70 p-2 dark:bg-slate-800">
                    <p className="text-lg font-bold text-emerald-600">{member.completed}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Done</p>
                  </div>
                  <div className="rounded-md bg-white/70 p-2 dark:bg-slate-800">
                    <p className={`text-lg font-bold ${member.overdue ? 'text-red-600' : 'text-slate-500'}`}>
                      {member.overdue}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500">Overdue</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Progress</span>
                    <span>{member.progress}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all"
                      style={{ width: `${member.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <FiMail className="h-3.5 w-3.5" />
                  <span className="truncate">{member.email}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
