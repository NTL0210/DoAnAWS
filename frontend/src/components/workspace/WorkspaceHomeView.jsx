import { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUploadCloud, FiCheckSquare, FiUserPlus, FiCalendar,
  FiFileText, FiUsers, FiCheckCircle, FiAlertCircle,
  FiArrowRight, FiClock, FiUser, FiZap, FiMic,
  FiBriefcase, FiBarChart2, FiPlus, FiStar, FiInfo,
} from 'react-icons/fi';
import { getDeadlineLabel, isDueSoon, isOverdue } from '@/utils/deadlineUtils';
import { getMemberWorkload } from '@/services/workloadService';

/**
 * WorkspaceHomeView — Welcome overview page when entering workspace
 * Shows stats, quick actions, activity, onboarding checklist
 */
export default function WorkspaceHomeView() {
  const {
    activeWorkspace,
    currentUser,
    workspaceRole,
    workspaceRoleLabels,
    workspaceMembers,
    workspaceTeams,
    workspaceTasks,
    workspaceMeetings,
    activityFeed,
    onboarding,
    selectView,
    setShowCreateTeam,
    setShowCreateChannel,
    setShowInviteMember,
    dismissOnboarding,
    completeOnboardingStep,
    showToast,
  } = useWorkspace();

  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const workspaceTaskList = useMemo(() => {
    if (!activeWorkspace) return [];
    return (workspaceTasks || []).filter(
      (t) => t.workspaceId === activeWorkspace.id || t.departmentId === activeWorkspace.id
    );
  }, [workspaceTasks, activeWorkspace]);

  const stats = useMemo(() => ({
    openTasks: workspaceTaskList.filter((t) => t.status !== 'COMPLETED').length,
    completedTasks: workspaceTaskList.filter((t) => t.status === 'COMPLETED').length,
    overdueTasks: workspaceTaskList.filter((t) => {
      if (t.status === 'COMPLETED' || !t.deadline) return false;
      return new Date(t.deadline) < new Date();
    }).length,
    totalMembers: workspaceMembers.length,
    totalTeams: workspaceTeams.length,
    totalMeetings: workspaceMeetings.filter((meeting) => meeting.workspaceId === activeWorkspace?.id).length,
    aiTasks: workspaceTaskList.filter((task) => task.sourceMeetingId).length,
  }), [workspaceTaskList, workspaceMembers, workspaceTeams, workspaceMeetings, activeWorkspace]);

  const upcomingDeadlines = useMemo(() => {
    return workspaceTaskList
      .filter((t) => t.status !== 'COMPLETED' && t.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 5);
  }, [workspaceTaskList]);

  const deadlineInsights = useMemo(() => ({
    withoutDeadline: workspaceTaskList.filter((task) => task.status !== 'COMPLETED' && !task.deadline).slice(0, 4),
    overdue: workspaceTaskList.filter((task) => task.status !== 'COMPLETED' && isOverdue(task.deadline)).slice(0, 4),
    dueSoon: workspaceTaskList.filter((task) => task.status !== 'COMPLETED' && isDueSoon(task.deadline)).slice(0, 4),
  }), [workspaceTaskList]);

  const workloadInsights = useMemo(() => {
    const workload = getMemberWorkload(workspaceTaskList, workspaceMembers);
    return {
      overloaded: workload.filter((member) => member.overloaded).slice(0, 4),
      idle: workload.filter((member) => member.activeCount === 0).slice(0, 4),
    };
  }, [workspaceMembers, workspaceTaskList]);

  const canUploadMeeting = workspaceRole === 'OWNER' || workspaceRole === 'MANAGER' || workspaceRole === 'VICE_ADMIN';
  const canCreateTask = workspaceRole === 'OWNER' || workspaceRole === 'MANAGER' || workspaceRole === 'VICE_ADMIN';
  const canInvite = workspaceRole === 'OWNER' || workspaceRole === 'VICE_ADMIN';
  const canCreateTeam = workspaceRole === 'OWNER' || workspaceRole === 'VICE_ADMIN';
  const isEmptyWorkspace = (activeWorkspace?.channels || []).length === 0
    && workspaceTeams.length === 0
    && workspaceTaskList.length === 0
    && stats.totalMeetings === 0;

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'HIGH': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      OWNER: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      VICE_ADMIN: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      MANAGER: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      EMPLOYEE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    };
    return colors[role] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
  };

  const formatDeadline = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d - now;
    if (diff < 0) return 'Overdue';
    if (diff < 86400000) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const recentActivities = useMemo(() => {
    if (activityFeed.length > 0) return activityFeed.slice(0, 5);
    // Default activities if none exist
    return [];
  }, [activityFeed]);

  // Onboarding steps definition
  const ONBOARDING_STEPS = [
    { key: 'invited', label: 'Invite members', icon: FiUserPlus, action: () => setShowInviteMember(true) },
    { key: 'teamCreated', label: 'Create team', icon: FiBriefcase, action: () => setShowCreateTeam(true) },
    { key: 'meetingUploaded', label: 'Upload first meeting', icon: FiUploadCloud, action: () => selectView('meetings') },
    { key: 'tasksReviewed', label: 'Review AI tasks', icon: FiCheckSquare, action: () => selectView('tasks') },
    { key: 'analyticsViewed', label: 'View analytics', icon: FiBarChart2, action: () => selectView('analytics') },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6 space-y-6">
      {isEmptyWorkspace ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Welcome to your new workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Start by creating a team, inviting members, or creating your first channel.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowCreateTeam(true)} className="workspace-action-lift rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">Create Team</button>
            <button type="button" onClick={() => setShowCreateChannel(true)} className="workspace-action-lift rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-black text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800">Create Text Channel</button>
            <button type="button" onClick={() => setShowCreateChannel(true)} className="workspace-action-lift rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-black text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800">Create Voice Channel</button>
            <button type="button" onClick={() => setShowInviteMember(true)} className="workspace-action-lift rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-black text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800">Invite Members</button>
            <button type="button" onClick={() => selectView('meetings')} className="workspace-action-lift rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-black text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800">Upload Meeting</button>
          </div>
        </div>
      ) : null}
      {/* ─── Welcome Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-300">
                {activeWorkspace?.name || 'Workspace'}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${getRoleBadgeColor(workspaceRole)}`}>
                {workspaceRoleLabels[workspaceRole] || 'Member'}
              </span>
            </div>
            <h1 className="text-2xl font-black md:text-3xl">
              {greeting}, {currentUser?.name?.split(' ')[0] || 'User'}! 👋
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Here&apos;s what&apos;s happening in your workspace today.
            </p>
          </div>

          {/* ─── Quick Stats Row ─── */}
          <div className="grid grid-cols-2 gap-2 lg:gap-3">
            <MetricPill label="Members" value={stats.totalMembers} icon={FiUsers} />
            <MetricPill label="Teams" value={stats.totalTeams} icon={FiBriefcase} />
            <MetricPill label="Meetings" value={stats.totalMeetings} icon={FiMic} />
            <MetricPill label="AI Tasks" value={stats.aiTasks} icon={FiZap} />
            <MetricPill label="Overdue" value={stats.overdueTasks} icon={FiAlertCircle} highlight={stats.overdueTasks > 0} />
          </div>
        </div>

        {/* ─── Quick Actions ─── */}
        <div className="mt-5 flex flex-wrap gap-2">
          {canUploadMeeting && (
            <button
              onClick={() => selectView('meetings')}
              className="workspace-action-lift inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition"
            >
              <FiZap className="h-4 w-4" />
              Upload Meeting
            </button>
          )}
          {canCreateTeam && (
            <button
              onClick={() => setShowCreateTeam(true)}
              className="workspace-action-lift inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition backdrop-blur-sm"
            >
              <FiPlus className="h-4 w-4" />
              Create Team
            </button>
          )}
          {canInvite && (
            <button
              onClick={() => setShowInviteMember(true)}
              className="workspace-action-lift inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition backdrop-blur-sm"
            >
              <FiUserPlus className="h-4 w-4" />
              Invite Members
            </button>
          )}
          <button
            onClick={() => selectView('tasks')}
            className="workspace-action-lift inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition backdrop-blur-sm"
          >
            <FiCheckSquare className="h-4 w-4" />
            View Tasks
          </button>
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* ─── Onboarding Checklist ─── */}
          {onboarding.showChecklist && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="workspace-card-25d rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FiStar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200">Getting Started Checklist</h3>
                </div>
                <button
                  onClick={dismissOnboarding}
                  className="text-xs font-semibold text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Dismiss
                </button>
              </div>
              <div className="space-y-2">
                {ONBOARDING_STEPS.map((step) => {
                  const done = onboarding.steps[step.key];
                  return (
                    <button
                      key={step.key}
                      onClick={done ? null : step.action}
                      disabled={done}
                      className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm transition ${
                        done
                          ? 'bg-white/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 cursor-default'
                          : 'workspace-action-lift bg-white dark:bg-slate-800 hover:bg-blue-100/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer'
                      }`}
                    >
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        done ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                      }`}>
                        {done ? <FiCheckCircle className="h-3.5 w-3.5" /> : <span className="text-xs font-bold">{ONBOARDING_STEPS.indexOf(step) + 1}</span>}
                      </div>
                      <span className={`font-semibold ${done ? 'line-through' : ''}`}>{step.label}</span>
                      {!done && <FiArrowRight className="h-3.5 w-3.5 ml-auto text-slate-300 dark:text-slate-600" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ─── Stats Grid ─── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<FiCheckSquare className="h-5 w-5" />} label="Open Tasks" value={stats.openTasks} sub={`${stats.completedTasks} completed`} color="primary" />
            <StatCard icon={<FiUsers className="h-5 w-5" />} label="Team Members" value={stats.totalMembers} sub={`${stats.totalTeams} teams`} color="emerald" />
            <StatCard icon={<FiBriefcase className="h-5 w-5" />} label="Teams" value={stats.totalTeams} sub={`${stats.totalMembers} members`} color="sky" />
            <StatCard icon={<FiAlertCircle className="h-5 w-5" />} label="Overdue Tasks" value={stats.overdueTasks} sub={stats.overdueTasks ? 'Need attention' : 'All clear'} color={stats.overdueTasks > 0 ? 'red' : 'emerald'} highlight={stats.overdueTasks > 0} />
          </div>

          {/* ─── Upcoming Deadlines ─── */}
          <div className="workspace-card-25d rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FiCalendar className="text-amber-500" />
                Upcoming Deadlines
              </h2>
              <button
                onClick={() => selectView('tasks')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
              >
                View all <FiArrowRight className="h-3 w-3" />
              </button>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic py-6 text-center">
                No upcoming deadlines. Create a task!
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((t) => (
                  <div
                    key={t.id}
                    className="workspace-action-lift flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 hover:border-slate-200 dark:hover:border-slate-600 transition cursor-pointer"
                    onClick={() => selectView('tasks')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                        <FiUser className="h-3 w-3 inline" />
                        {getAssigneeName(t.assigneeId)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getPriorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                      <span className={`text-xs whitespace-nowrap font-semibold ${isOverdue(t.deadline) ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {formatDeadline(t.deadline)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="workspace-card-25d rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <FiAlertCircle className="text-rose-500" />
              Deadline intelligence
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <InsightList title="No deadline" items={deadlineInsights.withoutDeadline} tone="amber" />
              <InsightList title="Overdue" items={deadlineInsights.overdue} tone="rose" />
              <InsightList title="Due soon" items={deadlineInsights.dueSoon} tone="blue" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* ─── Recent Activity ─── */}
          <div className="workspace-card-25d rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
              <FiClock className="text-blue-500" />
              Recent Activity
            </h2>
            {recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <FiInfo className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 dark:text-slate-500">No recent activity</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Actions in your workspace will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-[9px] font-bold text-primary-700 dark:text-primary-300 flex-shrink-0 mt-0.5">
                      {getInitials(act.userName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{act.message}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatTimeAgo(act.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Teams Overview ─── */}
          <div className="workspace-card-25d rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FiUsers className="text-emerald-500" />
                Teams ({workspaceTeams.length})
              </h2>
              {canCreateTeam && (
                <button
                  onClick={() => setShowCreateTeam(true)}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  + New
                </button>
              )}
            </div>
            {workspaceTeams.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic py-4 text-center">
                No teams yet. Create one to organize your workspace.
              </p>
            ) : (
              <div className="space-y-2">
                {workspaceTeams.slice(0, 5).map((team) => (
                  <div key={team.id} className="workspace-action-lift flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold"
                      style={{ backgroundColor: team.color || '#5865F2' }}
                    >
                      {getInitials(team.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{team.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{team.memberIds?.length || 0} members</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="workspace-card-25d rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <FiUsers className="text-violet-500" />
              Workload signals
            </h2>
            <div className="space-y-2">
              {workloadInsights.overloaded.length === 0 ? (
                <p className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">No overloaded members detected.</p>
              ) : workloadInsights.overloaded.map((member) => (
                <p key={member.userId} className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                  {member.name}: {member.activeCount} active tasks
                </p>
              ))}
              {workloadInsights.idle.length > 0 ? (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  No active tasks: {workloadInsights.idle.map((member) => member.name).join(', ')}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function getAssigneeName(userId) {
    if (!userId || userId === 'null') return 'Unassigned';
    const member = workspaceMembers.find((m) => m.userId === userId);
    return member?.name || member?.nickname || 'Unknown';
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }
}

/* ─── Metric Pill (dark header style) ─── */
function MetricPill({ label, value, icon: Icon, highlight }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-sm ${highlight ? 'ring-2 ring-red-400/50' : ''}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${highlight ? 'text-red-300' : 'text-blue-300'}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-black ${highlight ? 'text-red-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, sub, color, highlight }) {
  const colorMap = {
    primary: 'bg-primary-100 text-primary-600',
    sky: 'bg-sky-100 text-sky-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className={`workspace-card-25d rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 ${highlight ? 'ring-2 ring-red-200 dark:ring-red-900/50' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorMap[color] || colorMap.primary}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function InsightList({ title, items, tone }) {
  const toneClass = tone === 'rose'
    ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
    : tone === 'amber'
      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">None</p>
      ) : (
        <div className="space-y-2">
          {items.map((task) => (
            <div key={task.id} className={`rounded-lg px-3 py-2 text-xs font-bold ${toneClass}`}>
              <p className="truncate">{task.title}</p>
              <p className="mt-0.5 opacity-75">{getDeadlineLabel(task.deadline)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
