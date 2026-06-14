import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiLoader,
  FiLock,
  FiPlus,
  FiShield,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import AppShell from '../../src/components/layout/AppShell';
import { getDepartments, getUsers, getMeetings, getTasks } from '../../src/services/legacyDataService';

const quickActions = [
  { id: 'invite', label: 'Invite user', icon: FiPlus, color: 'from-blue-500 to-cyan-400' },
  { id: 'departments', label: 'Departments', icon: FiBriefcase, color: 'from-violet-500 to-fuchsia-400' },
  { id: 'roles', label: 'Roles', icon: FiLock, color: 'from-amber-500 to-orange-400' },
  { id: 'audit', label: 'Audit', icon: FiShield, color: 'from-emerald-500 to-teal-400' },
];

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activePanel, setActivePanel] = useState('overview');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('dept-1');
  const [dashboardData, setDashboardData] = useState({
    departments: [],
    users: [],
    meetings: [],
    tasks: [],
  });

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      const [departments, users, meetings, tasks] = await Promise.all([
        getDepartments(), getUsers(), getMeetings(), getTasks()
      ]);
      const admin = users.find((item) => item.role === 'ADMIN');
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const currentAdmin = storedUser?.role === 'ADMIN' ? { ...admin, ...storedUser } : admin;

      await new Promise((resolve) => setTimeout(resolve, 500));
      setUser(currentAdmin);
      setDashboardData({ departments, users, meetings, tasks });
      setLoading(false);
    };

    loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const activeUsers = dashboardData.users.filter((item) => item.status === 'ACTIVE').length;
    const completedTasks = dashboardData.tasks.filter((item) => item.status === 'COMPLETED').length;
    const processingMeetings = dashboardData.meetings.filter((item) => item.status === 'PROCESSING').length;
    const avgProgress = dashboardData.tasks.length
      ? Math.round(dashboardData.tasks.reduce((sum, task) => sum + task.progress, 0) / dashboardData.tasks.length)
      : 0;

    return [
      {
        label: 'Active users',
        value: activeUsers,
        detail: '+3 this month',
        icon: FiUsers,
        color: 'from-blue-500 to-cyan-400',
        progress: Math.min(100, Math.round((activeUsers / 16) * 100)),
      },
      {
        label: 'Departments',
        value: dashboardData.departments.length,
        detail: '4 operating spaces',
        icon: FiBriefcase,
        color: 'from-violet-500 to-fuchsia-400',
        progress: 72,
      },
      {
        label: 'Meetings',
        value: dashboardData.meetings.length,
        detail: `${processingMeetings} processing`,
        icon: FiFileText,
        color: 'from-amber-500 to-orange-400',
        progress: 64,
      },
      {
        label: 'Task progress',
        value: `${avgProgress}%`,
        detail: `${completedTasks} completed`,
        icon: FiCheckCircle,
        color: 'from-emerald-500 to-teal-400',
        progress: avgProgress,
      },
    ];
  }, [dashboardData]);

  const departmentLoad = useMemo(() => {
    return dashboardData.departments.map((department) => {
      const tasks = dashboardData.tasks.filter((task) => task.departmentId === department.id);
      const average = tasks.length
        ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
        : 0;

      return {
        id: department.id,
        name: department.name,
        members: department.memberIds.length,
        taskCount: tasks.length,
        overdue: tasks.filter((task) => task.status === 'OVERDUE').length,
        completed: tasks.filter((task) => task.status === 'COMPLETED').length,
        progress: average,
      };
    });
  }, [dashboardData]);

  const selectedDepartment = useMemo(() => {
    return departmentLoad.find((department) => department.id === selectedDepartmentId) || departmentLoad[0];
  }, [departmentLoad, selectedDepartmentId]);

  const recentActivity = useMemo(() => {
    const latestMeetings = dashboardData.meetings.slice(0, 3).map((meeting) => ({
      id: meeting.id,
      type: 'meeting',
      title: meeting.title,
      detail: meeting.status === 'PROCESSING' ? 'AI is extracting tasks' : 'Meeting summary ready',
      time: meeting.updatedAt,
      icon: FiFileText,
      color: 'bg-blue-50 text-blue-600',
    }));

    const latestTasks = dashboardData.tasks.slice(0, 3).map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      detail: `${task.status.replace('_', ' ')} - ${task.progress}%`,
      time: task.updatedAt,
      icon: FiCheckCircle,
      color: 'bg-emerald-50 text-emerald-600',
    }));

    return [...latestMeetings, ...latestTasks].slice(0, 5);
  }, [dashboardData]);

  const filteredActivity = useMemo(() => {
    return recentActivity.filter((activity) => {
      return activityFilter === 'all' || activity.type === activityFilter;
    });
  }, [activityFilter, recentActivity]);

  const workflowSteps = [
    { label: 'Upload', value: dashboardData.meetings.length, icon: FiFileText },
    { label: 'AI Summary', value: dashboardData.meetings.filter((item) => item.summary).length, icon: FiZap },
    { label: 'Task Extracted', value: dashboardData.tasks.length, icon: FiCheckCircle },
    { label: 'Assigned', value: dashboardData.tasks.filter((item) => item.assigneeId).length, icon: FiUsers },
  ];

  const handleScrollToPanel = (panelId) => {
    setActivePanel(panelId);
    requestAnimationFrame(() => {
      document.getElementById('admin-action-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
          <p className="mt-4 text-sm font-medium text-slate-500">Loading admin workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      eyebrow="Admin"
      title="Admin Dashboard"
      description="Turn meetings into tasks, then monitor company-wide execution."
    >
      {/* Hero section */}
      <motion.section
        id="admin-overview"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-[#5f2eea] via-[#e6378f] to-[#00b8ff] p-[1px] shadow-xl shadow-blue-900/10"
      >
        <div className="dashboard-shimmer relative overflow-hidden rounded-2xl bg-white/96 p-6 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-white/95 to-blue-50/90" />
          <div className="absolute right-8 top-4 h-36 w-36 rounded-full bg-pink-400/15 blur-3xl" />
          <div className="absolute bottom-0 right-40 h-28 w-28 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-bold text-primary-700">AI meeting workforce command</p>
              <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-normal text-slate-950 lg:text-4xl">
                Turn meetings into tasks, then monitor company-wide execution.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Track departments, users, uploaded meetings, AI-extracted tasks, and delivery progress from one admin workspace.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/workspace?view=meetings"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                >
                  <FiZap className="h-4 w-4" />
                  Upload MP3 for AI summary
                </Link>
                <Link
                  href="/workspace?view=meetings"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <FiFileText className="h-4 w-4" />
                  View meetings
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="dashboard-hero-scene hidden lg:block">
                <div className="dashboard-hero-stack">
                  <span className="dashboard-hero-card" />
                  <span className="dashboard-hero-card" />
                  <span className="dashboard-hero-card" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                {['Live', 'AI Ready', 'Secure'].map((label, index) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.08 }}
                    className="rounded-xl bg-slate-50 px-4 py-3 text-center"
                  >
                    <div className="mx-auto mb-2 h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <div className="text-xs font-semibold text-slate-600">{label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Metrics */}
      <section className="mt-6 grid gap-4 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.label} metric={metric} index={index} />
        ))}
      </section>

      {/* Department workload + Selected */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Department workload</h2>
              <p className="text-sm text-slate-500">Progress and capacity across operating spaces.</p>
            </div>
            <FiBarChart2 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-5">
            {departmentLoad.map((department, index) => (
              <button
                key={department.name}
                type="button"
                onClick={() => setSelectedDepartmentId(department.id)}
                className={`w-full rounded-xl p-3 text-left transition ${
                  selectedDepartmentId === department.id ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-slate-800">{department.name}</span>
                    <span className="ml-2 text-slate-400">{department.members} members</span>
                  </div>
                  <span className="font-semibold text-slate-700">{department.progress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${department.progress}%` }}
                    transition={{ delay: 0.35 + index * 0.08, duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400"
                  />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Selected department</h2>
              <p className="text-sm text-slate-500">Click a department to inspect workload.</p>
            </div>
            <FiBriefcase className="h-5 w-5 text-primary-500" />
          </div>
          {selectedDepartment && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm text-slate-300">{selectedDepartment.name}</p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <DepartmentStat label="Members" value={selectedDepartment.members} />
                  <DepartmentStat label="Tasks" value={selectedDepartment.taskCount} />
                  <DepartmentStat label="Done" value={selectedDepartment.completed} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Delivery progress</span>
                  <span className="font-semibold text-primary-600">{selectedDepartment.progress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedDepartment.progress}%` }}
                    transition={{ duration: 0.55 }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm">
                <span className="font-semibold text-orange-800">Overdue tasks</span>
                <span className="rounded-full bg-white px-3 py-1 font-bold text-orange-700">
                  {selectedDepartment.overdue}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      {/* Quick actions + Activity */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Quick actions</h2>
              <p className="text-sm text-slate-500">Common admin operations.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleScrollToPanel(action.id)}
                className="float-action group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-1 hover:bg-white hover:shadow-lg hover:shadow-slate-200/70"
                style={{ animationDelay: `${quickActions.findIndex((item) => item.id === action.id) * 0.18}s` }}
              >
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} text-white`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{action.label}</span>
                  <FiChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
          <div id="admin-action-panel">
            <ActionPanel
              activePanel={activePanel}
              departments={dashboardData.departments}
              users={dashboardData.users}
              tasks={dashboardData.tasks}
            />
          </div>
          <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
            <h3 className="text-sm font-bold">Core workflow</h3>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.06 }}
                  className="rounded-xl bg-white/10 p-3"
                >
                  <step.icon className="mb-2 h-4 w-4 text-cyan-300" />
                  <div className="text-lg font-bold">{step.value}</div>
                  <div className="text-[11px] text-slate-300">{step.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Recent activity</h2>
              <p className="text-sm text-slate-500">Filter and search mock meetings/tasks.</p>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {['all', 'meeting', 'task'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActivityFilter(item)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    activityFilter === item ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {filteredActivity.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.52 + index * 0.07 }}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activity.color}`}>
                  <activity.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{activity.title}</p>
                  <p className="text-xs text-slate-500">{activity.detail}</p>
                </div>
                <div className="hidden items-center gap-1 text-xs text-slate-400 sm:flex">
                  <FiClock className="h-3.5 w-3.5" />
                  {new Date(activity.time).toLocaleDateString()}
                </div>
              </motion.div>
            ))}
            {filteredActivity.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No activity matches your search.
              </div>
            )}
          </div>
        </motion.div>
      </section>
    </AppShell>
  );
}

function DepartmentStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-slate-300">{label}</div>
    </div>
  );
}

function ActionPanel({ activePanel, departments, users, tasks }) {
  const activeUsers = users.filter((user) => user.status === 'ACTIVE');
  const managers = users.filter((user) => user.role === 'MANAGER');
  const panelTitle = {
    overview: 'Workspace overview',
    invite: 'Invite user preview',
    departments: 'Department management',
    roles: 'Role overview',
    audit: 'Audit timeline',
  }[activePanel];

  return (
    <motion.div
      key={activePanel}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-950">{panelTitle}</h3>
        <Link
          href="/workspace?view=meetings"
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700"
        >
          Upload MP3
        </Link>
      </div>

      {activePanel === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <OverviewTile icon={FiBriefcase} label="Departments" value={departments.length} />
          <OverviewTile icon={FiUsers} label="Active users" value={activeUsers.length} />
          <OverviewTile icon={FiCheckCircle} label="Tracked tasks" value={tasks.length} />
          <button
            type="button"
            onClick={() => {
              document.getElementById('admin-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-white sm:col-span-3"
          >
            Jump back to top metrics
          </button>
        </div>
      )}

      {activePanel === 'invite' && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              readOnly
              value="new.member@company.com"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
            />
            <select className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600" defaultValue="EMPLOYEE">
              <option>EMPLOYEE</option>
              <option>MANAGER</option>
              <option>ADMIN</option>
            </select>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Mock interaction: form preview only. In real backend, this sends an invitation through Cognito/SNS.
          </p>
        </div>
      )}

      {activePanel === 'departments' && (
        <div className="space-y-2">
          {departments.map((department) => (
            <div key={department.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{department.name}</p>
                <p className="text-xs text-slate-500">{department.memberIds.length} members</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                {tasks.filter((task) => task.departmentId === department.id).length} tasks
              </span>
            </div>
          ))}
        </div>
      )}

      {activePanel === 'roles' && (
        <div className="grid grid-cols-3 gap-2">
          {['ADMIN', 'MANAGER', 'EMPLOYEE'].map((role) => (
            <div key={role} className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-xl font-bold text-slate-950">
                {users.filter((user) => user.role === role).length}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">{role}</div>
            </div>
          ))}
        </div>
      )}

      {activePanel === 'audit' && (
        <div className="space-y-2">
          {[
            `${activeUsers.length} active accounts verified`,
            `${managers.length} managers can upload meeting audio`,
            `${tasks.length} AI extracted tasks are tracked`,
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <FiCheckCircle className="h-4 w-4 text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function OverviewTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Icon className="mb-3 h-4 w-4 text-primary-600" />
      <div className="text-xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function MetricCard({ metric, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.07 }}
      whileHover={{ y: -4 }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{metric.label}</p>
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 + index * 0.08 }}
            className="mt-3 text-3xl font-bold tracking-normal text-slate-950"
          >
            {metric.value}
          </motion.div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${metric.color} text-white shadow-lg`}>
          <metric.icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>{metric.detail}</span>
        <span>{metric.progress}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${metric.progress}%` }}
          transition={{ delay: 0.35 + index * 0.07, duration: 0.75, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${metric.color}`}
        />
      </div>
    </motion.div>
  );
}
