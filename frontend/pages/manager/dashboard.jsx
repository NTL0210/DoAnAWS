import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiFileText,
  FiLoader,
  FiUploadCloud,
  FiUsers,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill } from '../../src/components/layout/AppShell';
import { getDepartments, getUsers, getMeetings, getTasks } from '../../src/services/legacyDataService';

export default function ManagerDashboard() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ departments: [], users: [], meetings: [], tasks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      const [departments, users, meetings, tasks] = await Promise.all([
        getDepartments(), getUsers(), getMeetings(), getTasks()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((item) => item.role === 'MANAGER');
      const currentUser = storedUser?.role === 'MANAGER' ? { ...fallback, ...storedUser } : fallback;

      await new Promise((resolve) => setTimeout(resolve, 450));
      setUser(currentUser);
      setData({ departments, users, meetings, tasks });
      setLoading(false);
    };

    loadDashboard();
  }, []);

  const dashboard = useMemo(() => {
    if (!user) return null;

    const department = data.departments.find((item) => item.id === user.departmentId);
    const teamMembers = data.users.filter((item) => item.departmentId === user.departmentId);
    const departmentTasks = data.tasks.filter((item) => item.departmentId === user.departmentId);
    const departmentMeetings = data.meetings
      .filter((item) => item.departmentId === user.departmentId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const completed = departmentTasks.filter((item) => item.status === 'COMPLETED').length;
    const inProgress = departmentTasks.filter((item) => item.status === 'IN_PROGRESS').length;
    const overdue = departmentTasks.filter((item) => item.deadline && new Date(item.deadline) < new Date()).length;
    const avgProgress = departmentTasks.length
      ? Math.round(departmentTasks.reduce((sum, task) => sum + task.progress, 0) / departmentTasks.length)
      : 0;

    const workload = teamMembers.map((member) => {
      const tasks = departmentTasks.filter((task) => task.assigneeId === member.id);
      const done = tasks.filter((task) => task.status === 'COMPLETED').length;
      return {
        ...member,
        taskCount: tasks.length,
        completed: done,
        overdue: tasks.filter((task) => task.deadline && new Date(task.deadline) < new Date()).length,
        progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      };
    });

    return {
      department,
      teamMembers,
      departmentTasks,
      departmentMeetings,
      completed,
      inProgress,
      overdue,
      avgProgress,
      workload,
    };
  }, [data, user]);

  if (loading || !dashboard || !user) {
    return <LoadingState label="Loading manager workspace..." />;
  }

  return (
    <AppShell
      user={user}
      eyebrow={dashboard.department?.name || 'Manager workspace'}
      title="Team execution overview"
      description="Review meeting outcomes, task progress, and team capacity from one focused command view."
      actions={
        <>
          <Link href="/workspace?view=meetings" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-[#fbfcfe] px-4 text-sm font-bold text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <FiFileText className="h-4 w-4" />
            Meetings
          </Link>
          <Link href="/workspace?view=meetings" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700">
            <FiUploadCloud className="h-4 w-4" />
            Upload
          </Link>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tasks" value={dashboard.departmentTasks.length} detail={`${dashboard.avgProgress}% average progress`} icon={FiBriefcase} tone="blue" />
        <StatCard label="Completed" value={dashboard.completed} detail="Ready for review" icon={FiCheckCircle} tone="green" />
        <StatCard label="In progress" value={dashboard.inProgress} detail="Actively moving" icon={FiBarChart2} tone="amber" />
        <StatCard label="Overdue" value={dashboard.overdue} detail="Needs manager attention" icon={FiAlertTriangle} tone={dashboard.overdue ? 'red' : 'slate'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel
          title="Team workload"
          description={`${dashboard.teamMembers.length} members in ${dashboard.department?.name || 'this team'}`}
        >
          <div className="space-y-4">
            {dashboard.workload.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="rounded-lg border border-slate-200/80 bg-[#f4f7fb] p-4 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="flex items-center gap-3">
                  <img src={member.avatar} alt={member.name} className="h-10 w-10 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{member.name}</p>
                      <StatusPill tone={member.overdue ? 'red' : 'blue'}>{member.taskCount} tasks</StatusPill>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/90 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${member.progress}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>{member.completed} completed</span>
                      <span>{member.progress}% load closed</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Recent meetings"
          description="Latest AI processing activity"
          action={<Link href="/workspace?view=meetings" className="text-sm font-bold text-primary-600 hover:text-primary-700">View all</Link>}
        >
          <div className="space-y-3">
            {dashboard.departmentMeetings.slice(0, 4).map((meeting) => (
              <Link
                key={meeting.id}
                href="/workspace?view=meetings"
                className="block rounded-lg border border-slate-200/80 p-4 transition hover:border-primary-200 hover:bg-primary-50/40 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    <FiCalendar className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{meeting.title}</h3>
                      <StatusPill tone={getMeetingTone(meeting.status)}>{meeting.status}</StatusPill>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{meeting.summary}</p>
                    <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-500">
                      {new Date(meeting.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Priority task queue" description="Work that most affects delivery" className="mt-6">
        <div className="grid gap-3 lg:grid-cols-2">
          {dashboard.departmentTasks
            .filter((task) => task.status !== 'COMPLETED')
            .slice(0, 4)
            .map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{task.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{task.description}</p>
                  </div>
                  <StatusPill tone={task.priority === 'HIGH' || task.priority === 'URGENT' ? 'red' : 'amber'}>
                    {task.priority}
                  </StatusPill>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1"><FiUsers className="h-3.5 w-3.5" /> {task.assigneeId ? 'Assigned' : 'Unassigned'}</span>
                  <span>{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}</span>
                </div>
              </div>
            ))}
        </div>
      </Panel>
    </AppShell>
  );
}

function LoadingState({ label }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] dark:bg-[#101820]">
      <div className="text-center">
        <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function getMeetingTone(status) {
  if (status === 'COMPLETED') return 'green';
  if (status === 'PROCESSING') return 'amber';
  if (status === 'FAILED') return 'red';
  return 'blue';
}
