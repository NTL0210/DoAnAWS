import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiFileText,
  FiLoader,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState } from '../../src/components/layout/AppShell';
import { getUsers, getTasks as getMockTasks, getMeetings, getDepartments } from '../../src/services/legacyDataService';

export default function AdminAnalytics() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ users: [], tasks: [], meetings: [], departments: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [users, tasks, meetings, departments] = await Promise.all([
        getUsers(), getMockTasks(), getMeetings(), getDepartments()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((u) => u.role === 'ADMIN');
      const currentUser = storedUser?.role === 'ADMIN' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 400));
      setUser(currentUser);
      setData({ users, tasks, meetings, departments });
      setLoading(false);
    };
    load();
  }, []);

  const analytics = useMemo(() => {
    if (!data.users.length) return null;

    const activeUsers = data.users.filter((u) => u.status === 'ACTIVE').length;
    const totalMeetings = data.meetings.length;
    const completedMeetings = data.meetings.filter((m) => m.status === 'COMPLETED').length;
    const processingMeetings = data.meetings.filter((m) => m.status === 'PROCESSING').length;

    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgressTasks = data.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const pendingTasks = data.tasks.filter((t) => t.status === 'PENDING').length;
    const overdueTasks = data.tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length;

    const avgProgress = totalTasks
      ? Math.round(data.tasks.reduce((s, t) => s + t.progress, 0) / totalTasks)
      : 0;

    const deptProductivity = data.departments.map((dept) => {
      const deptTasks = data.tasks.filter((t) => t.departmentId === dept.id);
      const done = deptTasks.filter((t) => t.status === 'COMPLETED').length;
      return {
        name: dept.name,
        total: deptTasks.length,
        completed: done,
        rate: deptTasks.length ? Math.round((done / deptTasks.length) * 100) : 0,
      };
    });

    const roleDist = {
      ADMIN: data.users.filter((u) => u.role === 'ADMIN').length,
      MANAGER: data.users.filter((u) => u.role === 'MANAGER').length,
      EMPLOYEE: data.users.filter((u) => u.role === 'EMPLOYEE').length,
    };

    return {
      activeUsers,
      totalMeetings,
      completedMeetings,
      processingMeetings,
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      overdueTasks,
      avgProgress,
      deptProductivity,
      roleDist,
    };
  }, [data]);

  if (loading || !analytics || !user) return <LoadingState label="Loading analytics..." />;

  return (
    <AppShell
      user={user}
      eyebrow="Admin"
      title="Company analytics"
      description="High-level metrics across departments, meetings, and tasks."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active users" value={analytics.activeUsers} detail="Across all roles" icon={FiUsers} tone="blue" />
        <StatCard label="Meetings" value={analytics.totalMeetings} detail={`${analytics.completedMeetings} completed`} icon={FiFileText} tone="amber" />
        <StatCard label="Tasks" value={analytics.totalTasks} detail={`${analytics.completedTasks} completed`} icon={FiCheckCircle} tone="green" />
        <StatCard label="Avg progress" value={`${analytics.avgProgress}%`} detail="Company-wide" icon={FiTrendingUp} tone="slate" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Department productivity */}
        <Panel title="Department productivity" description="Completion rate per department">
          <div className="space-y-4">
            {analytics.deptProductivity.map((dept, idx) => (
              <div key={dept.name} className="flex items-center gap-4">
                <span className="w-28 text-xs font-bold text-slate-600 dark:text-slate-400">{dept.name}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dept.rate}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.06 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400"
                    style={{ minWidth: dept.rate ? '20px' : 0 }}
                  />
                </div>
                <span className="w-16 text-right text-xs font-bold text-slate-700 dark:text-slate-300">
                  {dept.completed}/{dept.total}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Role distribution */}
        <Panel title="Role distribution" description="User breakdown by role">
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'ADMIN', label: 'Admins', value: analytics.roleDist.ADMIN, color: 'from-red-500 to-rose-400', icon: FiBarChart2 },
              { key: 'MANAGER', label: 'Managers', value: analytics.roleDist.MANAGER, color: 'from-amber-500 to-orange-400', icon: FiBriefcase },
              { key: 'EMPLOYEE', label: 'Employees', value: analytics.roleDist.EMPLOYEE, color: 'from-emerald-500 to-teal-400', icon: FiUsers },
            ].map((item) => {
              const max = Math.max(analytics.roleDist.ADMIN, analytics.roleDist.MANAGER, analytics.roleDist.EMPLOYEE, 1);
              return (
                <div key={item.key} className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-lg">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{item.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{item.label}</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.value / max) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Pipeline overview */}
      <Panel title="Workflow pipeline" description="End-to-end metrics: upload → summary → tasks → completion" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Meetings uploaded', value: analytics.totalMeetings, icon: FiFileText, color: 'bg-blue-50 text-blue-600' },
            { label: 'AI summaries ready', value: analytics.completedMeetings, icon: FiZap, color: 'bg-primary-50 text-primary-600' },
            { label: 'Tasks extracted', value: analytics.totalTasks, icon: FiCheckCircle, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Overdue items', value: analytics.overdueTasks, icon: FiCalendar, color: analytics.overdueTasks ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ y: -2 }}
              className="flex items-center gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 dark:border-slate-800 dark:bg-[#17212c]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
