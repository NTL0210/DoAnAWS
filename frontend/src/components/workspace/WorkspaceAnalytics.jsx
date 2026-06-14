import { useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi';

const statusConfig = {
  TODO: { label: 'Todo', color: 'bg-slate-400', accent: 'text-slate-500' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-500', accent: 'text-blue-600' },
  REVIEW: { label: 'Review', color: 'bg-amber-400', accent: 'text-amber-600' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-500', accent: 'text-emerald-600' },
  OVERDUE: { label: 'Overdue', color: 'bg-rose-500', accent: 'text-rose-600' },
};

export default function WorkspaceAnalytics() {
  const { activeWorkspace, workspaceMembers, workspaceTeams, workspaceTasks, workspaceMeetings, activityFeed } = useWorkspace();

  const analytics = useMemo(() => {
    const tasks = (workspaceTasks || []).filter((task) => task.departmentId === activeWorkspace?.id || !task.departmentId);
    const meetings = (workspaceMeetings || []).filter((meeting) => meeting.workspaceId === activeWorkspace?.id);

    const counts = Object.keys(statusConfig).reduce((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status).length;
      return acc;
    }, {});

    const totalTasks = tasks.length;
    const completedTasks = counts.COMPLETED || 0;
    const overdueTasks = tasks.filter((task) => task.status !== 'COMPLETED' && task.deadline && new Date(task.deadline) < new Date()).length + (counts.OVERDUE || 0);
    const activeTasks = (counts.TODO || 0) + (counts.IN_PROGRESS || 0) + (counts.REVIEW || 0);
    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const members = workspaceMembers?.length
      ? workspaceMembers
      : [
          { userId: 'u1', name: 'Alex Johnson', role: 'Owner' },
          { userId: 'u2', name: 'Sarah Chen', role: 'Manager' },
          { userId: 'u3', name: 'John Doe', role: 'Employee' },
        ];

    const workload = members.slice(0, 5).map((member) => {
      const assigned = tasks.filter((task) => task.assigneeId === member.userId);
      const done = assigned.filter((task) => task.status === 'COMPLETED').length;
      const percent = assigned.length ? Math.round((done / assigned.length) * 100) : 0;

      return {
        id: member.userId,
        name: member.name || member.nickname || 'Unknown',
        role: member.role || 'Member',
        assigned: assigned.length,
        done,
        percent,
      };
    });

    const tasksByTeam = (workspaceTeams || []).map((team) => ({
      id: team.id,
      name: team.name,
      count: tasks.filter((task) => task.teamId === team.id).length,
    }));

    const tasksByPriority = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => ({
      priority,
      count: tasks.filter((task) => task.priority === priority).length,
    }));

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      activeTasks,
      completionRate,
      meetingsTotal: meetings.length,
      meetingsProcessedByAI: meetings.filter((meeting) => ['AI_REVIEW_READY', 'TASKS_GENERATED', 'COMPLETED'].includes(meeting.status)).length,
      aiGeneratedTasks: tasks.filter((task) => task.sourceMeetingId).length,
      counts,
      workload,
      tasksByTeam,
      tasksByPriority,
      recentAIActivities: (activityFeed || []).filter((activity) => activity.type?.includes('ai') || activity.type?.includes('meeting') || activity.type?.includes('manager')).slice(0, 6),
    };
  }, [workspaceMembers, workspaceTeams, workspaceTasks, workspaceMeetings, activeWorkspace, activityFeed]);

  const kpis = [
    {
      label: 'Total Meetings',
      value: analytics.meetingsTotal,
      detail: `${analytics.meetingsProcessedByAI} processed by AI`,
      icon: FiCalendar,
      tone: 'from-blue-500 to-cyan-400',
      badge: '+18%',
    },
    {
      label: 'Generated Tasks',
      value: analytics.aiGeneratedTasks,
      detail: `${analytics.activeTasks} active assignments`,
      icon: FiTarget,
      tone: 'from-violet-500 to-fuchsia-500',
      badge: `${analytics.aiGeneratedTasks} AI`,
    },
    {
      label: 'Completion Rate',
      value: `${analytics.completionRate}%`,
      detail: `${analytics.completedTasks} tasks completed`,
      icon: FiCheckCircle,
      tone: 'from-emerald-500 to-teal-400',
      badge: '+7%',
    },
    {
      label: 'Overdue Tasks',
      value: analytics.overdueTasks,
      detail: analytics.overdueTasks ? 'Needs manager attention' : 'No urgent blockers',
      icon: FiAlertTriangle,
      tone: 'from-orange-500 to-rose-500',
      badge: analytics.overdueTasks ? 'Review' : 'Clear',
    },
  ];

  return (
    <div className="h-full overflow-y-auto discord-scroll bg-slate-50 px-5 py-5 md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-600">
                <FiBarChart2 className="h-4 w-4" />
                Workspace Analytics
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">
                Team delivery overview
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor meeting output, AI-created tasks, workload balance, and delivery risk for{' '}
                {activeWorkspace?.name || 'AI Workforce'}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['This Week', 'This Month', 'Last 30 Days'].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${
                    index === 1
                      ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <KpiCard key={item.label} {...item} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            eyebrow="Task health"
            title="Task status distribution"
            icon={FiActivity}
            action="View board"
          >
            <div className="space-y-4">
              {Object.entries(statusConfig).map(([status, config]) => (
                <ProgressRow
                  key={status}
                  label={config.label}
                  count={analytics.counts[status] || 0}
                  total={analytics.totalTasks}
                  barClassName={config.color}
                  accentClassName={config.accent}
                />
              ))}
            </div>
          </Panel>

          <Panel
            eyebrow="Team capacity"
            title="Member workload"
            icon={FiUsers}
            action="Balance work"
          >
            <div className="space-y-4">
              {analytics.workload.map((member) => (
                <WorkloadRow key={member.id} member={member} />
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <Panel eyebrow="Meeting insights" title="AI meeting output" icon={FiZap}>
            <div className="grid gap-3 sm:grid-cols-3">
              <InsightStat value={analytics.meetingsTotal} label="Total meetings" tone="text-blue-600" />
              <InsightStat value={analytics.meetingsProcessedByAI} label="AI reviewed" tone="text-emerald-600" />
              <InsightStat value={analytics.aiGeneratedTasks} label="AI task candidates" tone="text-violet-600" />
            </div>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
              <p className="text-sm font-bold text-slate-900">Next best action</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Review overdue and in-progress work before the next standup so managers can adjust ownership early.
              </p>
            </div>
          </Panel>

          <Panel eyebrow="Quick stats" title="Execution signals" icon={FiTrendingUp}>
            <div className="grid gap-3 sm:grid-cols-3">
              <SignalCard label="Completion rate" value={`${analytics.completionRate}%`} state="Healthy" color="emerald" />
              <SignalCard
                label="Tasks per member"
                value={(analytics.totalTasks / Math.max(1, analytics.workload.length)).toFixed(1)}
                state="Balanced"
                color="blue"
              />
              <SignalCard
                label="Overdue rate"
                value={`${Math.round((analytics.overdueTasks / Math.max(1, analytics.totalTasks)) * 100)}%`}
                state={analytics.overdueTasks ? 'Watch' : 'Clear'}
                color={analytics.overdueTasks ? 'rose' : 'emerald'}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {['View overdue tasks', 'Open meetings', 'Team workload'].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                >
                  {label}
                  <FiArrowRight className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <Panel eyebrow="Team distribution" title="Tasks by team" icon={FiUsers}>
            <div className="space-y-3">
              {analytics.tasksByTeam.map((team) => (
                <ProgressRow key={team.id} label={team.name} count={team.count} total={Math.max(analytics.totalTasks, 1)} barClassName="bg-blue-500" accentClassName="text-blue-600" />
              ))}
              {analytics.tasksByTeam.length === 0 && <p className="text-sm font-medium text-slate-400">No teams yet.</p>}
            </div>
          </Panel>
          <Panel eyebrow="Priority mix" title="Tasks by priority" icon={FiAlertTriangle}>
            <div className="space-y-3">
              {analytics.tasksByPriority.map((item) => (
                <ProgressRow key={item.priority} label={item.priority} count={item.count} total={Math.max(analytics.totalTasks, 1)} barClassName={item.priority === 'URGENT' ? 'bg-rose-500' : item.priority === 'HIGH' ? 'bg-orange-500' : item.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-400'} accentClassName="text-slate-600" />
              ))}
            </div>
          </Panel>
          <Panel eyebrow="AI activity" title="Recent AI activities" icon={FiZap}>
            <div className="space-y-3">
              {analytics.recentAIActivities.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-700">{activity.message}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">{formatDateTime(activity.timestamp)}</p>
                </div>
              ))}
              {analytics.recentAIActivities.length === 0 && <p className="text-sm font-medium text-slate-400">No AI activity yet.</p>}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone, badge }) {
  return (
    <article className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-lg shadow-slate-200`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{detail}</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {badge}
        </span>
      </div>
    </article>
  );
}

function Panel({ eyebrow, title, icon: Icon, action, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            <Icon className="h-4 w-4 text-blue-500" />
            {eyebrow}
          </div>
          <h2 className="mt-1 text-lg font-extrabold text-slate-950">{title}</h2>
        </div>
        {action && (
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-blue-700"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ProgressRow({ label, count, total, barClassName, accentClassName }) {
  const percent = total ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className={`font-extrabold ${accentClassName}`}>{count}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barClassName} transition-all duration-500`}
          style={{ width: `${Math.max(percent, count ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function WorkloadRow({ member }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-extrabold text-white">
          {getInitials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-extrabold text-slate-900">{member.name}</p>
            <span className="text-xs font-bold text-slate-500">
              {member.done}/{member.assigned} done
            </span>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{member.role}</p>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
          style={{ width: `${Math.max(member.percent, member.assigned ? 10 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function InsightStat({ value, label, tone }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
      <p className={`text-2xl font-extrabold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function SignalCard({ label, value, state, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  return (
    <div className={`rounded-2xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{state}</p>
    </div>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
