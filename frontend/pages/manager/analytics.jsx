import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiTrendingUp,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState } from '../../src/components/layout/AppShell';
import { getUsers, getTasks as getMockTasks, getMeetings } from '../../src/services/legacyDataService';

export default function ManagerAnalytics() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ users: [], tasks: [], meetings: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [users, tasks, meetings] = await Promise.all([
        getUsers(), getMockTasks(), getMeetings()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((u) => u.role === 'MANAGER');
      const currentUser = storedUser?.role === 'MANAGER' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 350));
      setUser(currentUser);
      setData({ users, tasks, meetings });
      setLoading(false);
    };
    load();
  }, []);

  const analytics = useMemo(() => {
    if (!user) return null;
    const deptTasks = data.tasks.filter((t) => t.departmentId === user.departmentId);
    const deptMeetings = data.meetings.filter((m) => m.departmentId === user.departmentId);
    const teamMembers = data.users.filter((u) => u.departmentId === user.departmentId && u.role !== 'MANAGER');

    const completed = deptTasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgress = deptTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const pending = deptTasks.filter((t) => t.status === 'PENDING').length;
    const overdue = deptTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length;
    const avgProgress = deptTasks.length
      ? Math.round(deptTasks.reduce((s, t) => s + t.progress, 0) / deptTasks.length)
      : 0;

    const priorityDist = {
      URGENT: deptTasks.filter((t) => t.priority === 'URGENT').length,
      HIGH: deptTasks.filter((t) => t.priority === 'HIGH').length,
      MEDIUM: deptTasks.filter((t) => t.priority === 'MEDIUM').length,
      LOW: deptTasks.filter((t) => t.priority === 'LOW').length,
    };

    const memberProductivity = teamMembers.map((member) => {
      const tasks = deptTasks.filter((t) => t.assigneeId === member.id);
      const done = tasks.filter((t) => t.status === 'COMPLETED').length;
      return {
        name: member.name,
        avatar: member.avatar,
        total: tasks.length,
        completed: done,
        productivity: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      };
    });

    return {
      deptTasks,
      deptMeetings,
      teamMembers,
      completed,
      inProgress,
      pending,
      overdue,
      avgProgress,
      priorityDist,
      memberProductivity,
    };
  }, [user, data]);

  if (loading || !analytics || !user) return <LoadingState label="Loading analytics..." />;

  const maxPriority = Math.max(...Object.values(analytics.priorityDist), 1);

  return (
    <AppShell
      user={user}
      eyebrow="Department analytics"
      title="Performance & metrics"
      description="Understand team velocity, task distribution, and productivity trends."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Avg progress" value={`${analytics.avgProgress}%`} detail="Completion rate" icon={FiTrendingUp} tone="blue" />
        <StatCard label="Completed" value={analytics.completed} detail="Closed tasks" icon={FiCheckCircle} tone="green" />
        <StatCard label="In progress" value={analytics.inProgress} detail="Active items" icon={FiBarChart2} tone="amber" />
        <StatCard label="Overdue rate" value={`${analytics.deptTasks.length ? Math.round((analytics.overdue / analytics.deptTasks.length) * 100) : 0}%`} detail="Requires attention" icon={FiClock} tone={analytics.overdue ? 'red' : 'slate'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Priority distribution */}
        <Panel title="Priority distribution" description="Task count by priority level">
          <div className="space-y-4">
            {[
              { key: 'URGENT', label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-600' },
              { key: 'HIGH', label: 'High', color: 'bg-orange-500', textColor: 'text-orange-600' },
              { key: 'MEDIUM', label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
              { key: 'LOW', label: 'Low', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-4">
                <span className={`w-16 text-xs font-bold ${item.textColor}`}>{item.label}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(analytics.priorityDist[item.key] / maxPriority) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${item.color}`}
                    style={{ minWidth: analytics.priorityDist[item.key] ? '20px' : 0 }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-bold text-slate-700 dark:text-slate-300">
                  {analytics.priorityDist[item.key]}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Team productivity */}
        <Panel title="Member productivity" description="Task completion rate per person">
          <div className="space-y-4">
            {analytics.memberProductivity.map((member, idx) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="flex items-center gap-3"
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="h-9 w-9 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{member.name}</span>
                    <span className="text-xs font-bold text-slate-500">
                      {member.completed}/{member.total} done
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${member.productivity}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400"
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-primary-600">{member.productivity}%</span>
              </motion.div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Summary stats */}
      <Panel title="Summary" description="Quick department snapshot" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total meetings', value: analytics.deptMeetings.length, icon: FiCalendar },
            { label: 'Total tasks', value: analytics.deptTasks.length, icon: FiBriefcase },
            { label: 'Team members', value: analytics.teamMembers.length, icon: FiUsers },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <stat.icon className="h-6 w-6 text-primary-500" />
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
