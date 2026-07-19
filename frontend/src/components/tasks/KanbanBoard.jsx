import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useWorkspace } from '@/context/WorkspaceContext';
import { FiAlertTriangle, FiCheckSquare, FiInfo, FiPlus, FiUser, FiCalendar, FiTrash2 } from 'react-icons/fi';
import {
  getDeadlineCountdown,
  getDeadlineDateLabel,
  getDeadlineWarning,
} from '@/utils/deadlineUtils';
import { getMemberWorkload } from '@/services/workloadService';
import { formatSourceEvidence } from '@/utils/sourceEvidenceUtils';

/**
 * KanbanBoard — Task board with columns: Todo, In Progress, Review, Done
 * Uses workspaceTasks from WorkspaceContext (shared with AI meetings)
 */
export default function KanbanBoard() {
  const router = useRouter();
  const {
    activeWorkspace,
    currentUser,
    workspaceRole,
    can,
    workspaceMembers,
    workspaceTasks,
    workspaceMeetings,
    addWorkspaceTasks,
    moveWorkspaceTask,
    deleteWorkspaceTask,
  } = useWorkspace();

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    priority: 'MEDIUM',
    startDate: '',
    deadline: '',
  });
  const [visibleByColumn, setVisibleByColumn] = useState({
    PENDING: 50,
    IN_PROGRESS: 50,
    REVIEW: 50,
    OVERDUE: 50,
    COMPLETED: 50,
  });

  // Filter tasks to current workspace
  const tasks = useMemo(() => {
    return workspaceTasks.filter((task) => {
      const workspaceId = task.workspaceId || task.departmentId;
      return !task.deletedAt && workspaceId === activeWorkspace?.id;
    });
  }, [workspaceTasks, activeWorkspace?.id]);
  const focusedTaskId = Array.isArray(router.query.taskId) ? router.query.taskId[0] : router.query.taskId;

  useEffect(() => {
    if (!focusedTaskId) return undefined;
    const focusedTask = tasks.find((task) => task.id === focusedTaskId);
    if (!focusedTask) return undefined;
    const taskIndex = tasks.filter((task) => task.status === focusedTask.status).findIndex((task) => task.id === focusedTaskId);
    setVisibleByColumn((prev) => ({
      ...prev,
      [focusedTask.status]: Math.max(prev[focusedTask.status] || 50, taskIndex + 1),
    }));
    const timer = window.setTimeout(() => {
      document.getElementById(`task-${focusedTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusedTaskId, tasks]);

  const columns = useMemo(() => {
    const baseColumns = [
      { id: 'PENDING', title: 'Todo', tasks: [], color: '#949ba4' },
      { id: 'IN_PROGRESS', title: 'In Progress', tasks: [], color: '#5865F2' },
      { id: 'REVIEW', title: 'Review', tasks: [], color: '#fea55a' },
      { id: 'OVERDUE', title: 'Overdue', tasks: [], color: '#ef4444' },
      { id: 'COMPLETED', title: 'Done', tasks: [], color: '#3ba55d' },
    ];
    const grouped = tasks.reduce((acc, task) => {
      acc[task.status] = [...(acc[task.status] || []), task];
      return acc;
    }, {});
    return baseColumns.map((column) => ({ ...column, tasks: grouped[column.id] || [] }));
  }, [tasks]);

  const canCreateTask = can('tasks.create') || workspaceRole === 'OWNER' || workspaceRole === 'MANAGER' || workspaceRole === 'VICE_ADMIN';
  const canAssign = can('tasks.assign') || workspaceRole === 'OWNER' || workspaceRole === 'MANAGER' || workspaceRole === 'VICE_ADMIN';
  const canDeleteTask = can('tasks.delete') || workspaceRole === 'OWNER' || workspaceRole === 'MANAGER' || workspaceRole === 'VICE_ADMIN';
  const isReviewer = can('tasks.approve');

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    const task = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      priority: newTask.priority,
      assigneeId: newTask.assigneeId || null,
      startDate: newTask.startDate || null,
      deadline: newTask.deadline || null,
    };

    addWorkspaceTasks([task]);
    setNewTask({ title: '', description: '', assigneeId: '', priority: 'MEDIUM', startDate: '', deadline: '' });
    setShowCreateTask(false);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      URGENT: 'text-red-400',
      HIGH: 'text-orange-400',
      MEDIUM: 'text-yellow-400',
      LOW: 'text-slate-400',
    };
    return colors[priority] || colors.MEDIUM;
  };

  const getPriorityBg = (priority) => {
    const colors = {
      URGENT: 'border-l-2 border-l-red-500',
      HIGH: 'border-l-2 border-l-orange-500',
      MEDIUM: 'border-l-2 border-l-amber-400',
      LOW: 'border-l-2 border-l-slate-400',
    };
    return colors[priority] || colors.MEDIUM;
  };

  const getUserName = useCallback((userId) => {
    if (!userId || userId === 'null' || userId === 'undefined') return 'Unassigned';
    const member = workspaceMembers.find((m) => m.userId === userId);
    return member?.name || member?.nickname || (currentUser?.id === userId ? currentUser.name : 'Unknown');
  }, [workspaceMembers, currentUser]);

  const getMeetingTitle = useCallback((meetingId) => {
    if (!meetingId) return '';
    const meeting = workspaceMeetings?.find((item) => item.id === meetingId);
    return meeting?.title || '';
  }, [workspaceMeetings]);

  const totalTasks = tasks.length;
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'COMPLETED').length, [tasks]);
  const workload = useMemo(() => getMemberWorkload(tasks, workspaceMembers), [tasks, workspaceMembers]);

  const getTaskAction = (task) => {
    const isAssignee = task.assigneeId && task.assigneeId === currentUser?.id;
    if (isAssignee && task.status === 'PENDING') {
      return { label: 'Start', nextStatus: 'IN_PROGRESS' };
    }
    if (isAssignee && ['IN_PROGRESS', 'OVERDUE'].includes(task.status)) {
      return { label: 'Complete', nextStatus: 'REVIEW' };
    }
    if (isReviewer && task.status === 'REVIEW') {
      return { label: 'Approve', nextStatus: 'COMPLETED' };
    }
    return null;
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf1f4] text-slate-900 dark:bg-[#080c12] dark:text-slate-100">
      {/* ─── Board Header ─── */}
      <div className="dashboard-command-hero workspace-cut-corner relative mx-5 mt-5 overflow-hidden px-5 py-4 text-white">
        <div className="dashboard-command-grid" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-orange-500 text-white shadow-lg shadow-orange-950/30 [clip-path:polygon(0_0,calc(100%_-_10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%_-_10px))]">
              <FiCheckSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase text-orange-300">Execution board</p>
              <h1 className="mt-0.5 text-xl font-black text-white">My Tasks</h1>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {completedTasks}/{totalTasks} completed
                {totalTasks > 0 ? ` · ${Math.round((completedTasks / totalTasks) * 100)}% delivery rate` : ''}
              </p>
            </div>
          </div>
          {canCreateTask && (
            <button
              onClick={() => setShowCreateTask(true)}
              className="workspace-command-button is-primary shrink-0"
            >
              <FiPlus className="h-4 w-4" /> New Task
            </button>
          )}
        </div>
      </div>

      {/* ─── Create Task Modal ─── */}
      {showCreateTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCreateTask(false)}
        >
          <div
            className="workspace-tactical-panel workspace-cut-corner w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 mb-4 dark:text-slate-100">Create Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Title</label>
                <input
                  id="task-title"
                  name="taskTitle"
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</label>
                <textarea
                  id="task-description"
                  name="taskDescription"
                  className="w-full min-h-[80px] resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Priority</label>
                  <select
                    id="task-priority"
                    name="taskPriority"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Start date</label>
                  <input
                    id="task-start-date"
                    name="taskStartDate"
                    type="date"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    value={newTask.startDate}
                    onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Deadline</label>
                  <input
                    id="task-deadline"
                    name="taskDeadline"
                    type="date"
                    min={newTask.startDate || undefined}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  />
                </div>
              </div>
              {canAssign && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assignee</label>
                  <select
                    id="task-assignee"
                    name="taskAssignee"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    value={newTask.assigneeId}
                    onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {workspaceMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.nickname || m.name || 'Unknown'} - {workload.find((item) => item.userId === m.userId)?.activeCount || 0} active tasks
                      </option>
                    ))}
                    {currentUser && !workspaceMembers.find((m) => m.userId === currentUser.id) && (
                      <option value={currentUser.id}>{currentUser.name} (you)</option>
                    )}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTask.title.trim()}
                  className="workspace-command-button is-primary px-5 disabled:opacity-50"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Kanban Columns ─── */}
      <div className="flex-1 overflow-x-auto p-5">
        <div className="flex h-full min-h-[400px] gap-4">
          {columns.map((col) => (
            <section key={col.id} className="dashboard-panel workspace-cut-corner flex min-w-[280px] max-w-[320px] flex-1 flex-col p-3.5">
              {/* Column Header */}
              <div className="flex min-h-9 items-center gap-2 border-b border-slate-200/80 px-1 pb-3 dark:border-slate-700/70">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {col.title}
                </span>
                <span className="ml-auto rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                  {col.tasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="workspace-column-scroll flex-1 space-y-3 overflow-y-auto pb-4">
                {col.tasks.slice(0, visibleByColumn[col.id] || 50).map((task) => {
                  const evidence = formatSourceEvidence({
                    ...task,
                    sourceMeetingTitle: task.sourceMeetingTitle || getMeetingTitle(task.sourceMeetingId),
                  });
                  const deadlineWarning = getDeadlineWarning(task.deadline);
                  const deadlineCountdown = getDeadlineCountdown(task.deadline);

                  return (
                    <article
                      key={task.id}
                      id={`task-${task.id}`}
                      className={`workspace-tactical-panel workspace-cut-corner p-4 transition hover:-translate-y-0.5 hover:border-orange-500/30 ${getPriorityBg(task.priority)} ${focusedTaskId === task.id ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-950' : ''}`}
                    >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {task.generatedFromAI ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">AI Generated</span>
                      ) : null}
                      {deadlineWarning ? (
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-black ${deadlineWarning.tone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                          <FiAlertTriangle className="h-3 w-3" />
                          {deadlineWarning.label}
                        </span>
                      ) : null}
                      {canDeleteTask ? (
                        <button
                          type="button"
                          onClick={() => deleteWorkspaceTask(task.id)}
                          className="ml-auto rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Move task to Trash"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1 leading-snug dark:text-slate-100">
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed dark:text-slate-400">
                        {task.description}
                      </p>
                    )}
                    {task.sourceMeetingId && (
                      <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-300">
                        Source meeting: {evidence.sourceMeetingTitle || 'Linked meeting'}
                        {evidence.sourceTimestamp ? <span className="ml-1 text-blue-500">At {evidence.sourceTimestamp}</span> : null}
                      </div>
                    )}
                    {task.generatedFromAI && (task.sourceQuote || task.transcriptExcerpt || task.reason || task.sourceMeetingId) ? (
                      <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                        <summary className="flex cursor-pointer items-center gap-1 font-black text-slate-700 dark:text-slate-300">
                          <FiInfo className="h-3 w-3" /> Source Evidence
                        </summary>
                        {evidence.reason ? (
                          <p className="mt-2"><span className="font-bold">Reason:</span> {evidence.reason}</p>
                        ) : null}
                        <p className="mt-1"><span className="font-bold">Evidence:</span> {evidence.sourceQuote}</p>
                      </details>
                    ) : null}
                    <div className="border-t border-slate-200/80 pt-3 text-xs text-slate-400 dark:border-slate-700/70">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex items-center gap-1">
                          <FiUser className="h-3 w-3" />
                          {getUserName(task.assigneeId)}
                        </span>
                        <span className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                          <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300">
                            <FiCalendar className="h-3 w-3" />
                            {getDeadlineDateLabel(task.deadline)}
                          </span>
                          <span className={deadlineWarning?.tone === 'red' ? 'font-bold text-red-500' : deadlineWarning?.key === 'soon' ? 'font-bold text-amber-500' : ''}>
                            {deadlineCountdown}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Move Buttons */}
                    {getTaskAction(task) && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            const action = getTaskAction(task);
                            if (action) moveWorkspaceTask(task.id, action.nextStatus);
                          }}
                          className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2 text-xs font-black uppercase text-white transition hover:brightness-110 [clip-path:polygon(0_0,calc(100%_-_9px)_0,100%_9px,100%_100%,9px_100%,0_calc(100%_-_9px))]"
                        >
                          {getTaskAction(task)?.label}
                        </button>
                      </div>
                    )}
                    </article>
                  );
                })}
                {col.tasks.length > (visibleByColumn[col.id] || 50) && (
                  <button
                    type="button"
                    onClick={() => setVisibleByColumn((prev) => ({ ...prev, [col.id]: (prev[col.id] || 50) + 50 }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    Show 50 more
                  </button>
                )}
                {col.tasks.length === 0 && (
                  <div className="workspace-cut-corner flex items-center justify-center border border-dashed border-slate-300 bg-slate-100/70 py-10 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                    {col.id === 'PENDING' ? 'Drop new tasks here' : 'No tasks'}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
