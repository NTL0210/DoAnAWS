import { useCallback, useMemo, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { FiAlertTriangle, FiInfo, FiPlus, FiUser, FiCalendar, FiTrash2 } from 'react-icons/fi';
import { getDeadlineLabel, getDeadlineWarning } from '@/utils/deadlineUtils';
import { getMemberWorkload } from '@/services/workloadService';
import { formatSourceEvidence } from '@/utils/sourceEvidenceUtils';

/**
 * KanbanBoard — Task board with columns: Todo, In Progress, Review, Done
 * Uses workspaceTasks from WorkspaceContext (shared with AI meetings)
 */
export default function KanbanBoard() {
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
    deadline: '',
  });
  const [visibleByColumn, setVisibleByColumn] = useState({
    TODO: 50,
    IN_PROGRESS: 50,
    REVIEW: 50,
    COMPLETED: 50,
  });

  // Filter tasks to current workspace
  const tasks = useMemo(() => {
    return workspaceTasks.filter((task) => {
      const workspaceId = task.workspaceId || task.departmentId;
      return !task.deletedAt && workspaceId === activeWorkspace?.id;
    });
  }, [workspaceTasks, activeWorkspace?.id]);

  const columns = useMemo(() => {
    const baseColumns = [
      { id: 'TODO', title: 'Todo', tasks: [], color: '#949ba4' },
      { id: 'IN_PROGRESS', title: 'In Progress', tasks: [], color: '#5865F2' },
      { id: 'REVIEW', title: 'Review', tasks: [], color: '#fea55a' },
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
  const canUpdateStatus = can('tasks.update_status') || workspaceRole === 'OWNER' || workspaceRole === 'EMPLOYEE';
  const canDeleteTask = can('tasks.delete') || workspaceRole === 'OWNER' || workspaceRole === 'MANAGER' || workspaceRole === 'VICE_ADMIN';

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    const task = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      priority: newTask.priority,
      assigneeId: newTask.assigneeId || null,
      deadline: newTask.deadline || null,
    };

    addWorkspaceTasks([task]);
    setNewTask({ title: '', description: '', assigneeId: '', priority: 'MEDIUM', deadline: '' });
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
      URGENT: 'bg-red-500/10 border-red-500/30',
      HIGH: 'bg-orange-500/10 border-orange-500/30',
      MEDIUM: 'bg-yellow-500/10 border-yellow-500/30',
      LOW: 'bg-slate-500/10 border-slate-500/30',
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

  const canMoveNext = (colId, task) => {
    if (colId === 'TODO') return true;
    if (colId === 'IN_PROGRESS') return true;
    if (colId === 'REVIEW') return true;
    return false;
  };

  const canMovePrev = (colId) => {
    if (colId === 'IN_PROGRESS') return true;
    if (colId === 'REVIEW') return true;
    if (colId === 'COMPLETED') return true;
    return false;
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* ─── Board Header ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            📋 Task Board
          </h1>
          <div className="text-xs text-slate-500 mt-1 dark:text-slate-400">
            {completedTasks}/{totalTasks} tasks completed
            {totalTasks > 0 && (
              <span className="ml-2">
                — {Math.round((completedTasks / totalTasks) * 100)}% done
              </span>
            )}
          </div>
        </div>
        {canCreateTask && (
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 hover:bg-primary-700 transition"
          >
            <FiPlus className="h-4 w-4" /> New Task
          </button>
        )}
      </div>

      {/* ─── Create Task Modal ─── */}
      {showCreateTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCreateTask(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-[#fbfcfe] p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 mb-4 dark:text-slate-100">Create Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Title</label>
                <input
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
                  className="w-full min-h-[80px] resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Priority</label>
                  <select
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
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Deadline</label>
                  <input
                    type="date"
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
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Kanban Columns ─── */}
      <div className="flex-1 overflow-x-auto bg-slate-50 p-6 dark:bg-slate-900">
        <div className="flex gap-5 h-full min-h-[400px]">
          {columns.map((col) => (
            <div key={col.id} className="min-w-[280px] max-w-[320px] flex-1 flex flex-col">
              {/* Column Header */}
              <div className="flex items-center gap-2 px-1 pb-3">
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
              <div className="flex-1 space-y-3 overflow-y-auto pb-4">
                {col.tasks.slice(0, visibleByColumn[col.id] || 50).map((task) => {
                  const evidence = formatSourceEvidence({
                    ...task,
                    sourceMeetingTitle: task.sourceMeetingTitle || getMeetingTitle(task.sourceMeetingId),
                  });

                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl border bg-white p-4 transition hover:shadow-md dark:bg-slate-900/80 ${getPriorityBg(task.priority)}`}
                    >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {task.generatedFromAI ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">AI Generated</span>
                      ) : null}
                      {getDeadlineWarning(task.deadline) ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${getDeadlineWarning(task.deadline).tone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                          <FiAlertTriangle className="h-3 w-3" />
                          {getDeadlineWarning(task.deadline).label}
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
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <FiUser className="h-3 w-3" />
                          {getUserName(task.assigneeId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FiCalendar className="h-3 w-3" />
                          {getDeadlineLabel(task.deadline)}
                        </span>
                      </div>
                    </div>

                    {/* Move Buttons */}
                    {canUpdateStatus && (
                      <div className="mt-3 flex gap-2">
                        {canMovePrev(col.id) && (
                          <button
                            onClick={() => moveWorkspaceTask(task.id, getPrevStatus(col.id))}
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            ← {getPrevStatusLabel(col.id)}
                          </button>
                        )}
                        {canMoveNext(col.id) && (
                          <button
                            onClick={() => moveWorkspaceTask(task.id, getNextStatus(col.id))}
                            className="flex-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition"
                          >
                            {getNextStatusLabel(col.id)} →
                          </button>
                        )}
                      </div>
                    )}
                    </div>
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
                  <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white py-10 text-xs font-semibold italic text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                    {col.id === 'TODO' ? 'Drop new tasks here' : 'No tasks'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getNextStatus(status) {
  const order = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
  const idx = order.indexOf(status);
  return idx < order.length - 1 ? order[idx + 1] : status;
}

function getPrevStatus(status) {
  const order = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
  const idx = order.indexOf(status);
  return idx > 0 ? order[idx - 1] : status;
}

function getNextStatusLabel(status) {
  const labels = { TODO: 'Start', IN_PROGRESS: 'Review', REVIEW: 'Done' };
  return labels[status] || 'Move';
}

function getPrevStatusLabel(status) {
  const labels = { IN_PROGRESS: 'Todo', REVIEW: 'In Progress', COMPLETED: 'Review' };
  return labels[status] || 'Back';
}
