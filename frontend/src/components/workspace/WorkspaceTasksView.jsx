import { useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import KanbanBoard from '@/components/tasks/KanbanBoard';

/**
 * WorkspaceTasksView — Wrapper for KanbanBoard with workspace context
 * Ensures tasks are filtered to the current workspace
 */
export default function WorkspaceTasksView() {
  const {
    workspaceRole,
    can,
  } = useWorkspace();

  // Permission check: can view tasks?
  const canViewTasks = can('tasks.view') ||
    workspaceRole === 'OWNER' ||
    workspaceRole === 'MANAGER' ||
    workspaceRole === 'VICE_ADMIN' ||
    workspaceRole === 'EMPLOYEE';

  if (!canViewTasks) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-slate-500">You do not have permission to view tasks.</p>
        </div>
      </div>
    );
  }

  return <KanbanBoard />;
}
