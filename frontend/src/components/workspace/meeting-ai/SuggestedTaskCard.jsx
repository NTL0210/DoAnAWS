import { useMemo, useState } from 'react';
import { FiAlertTriangle, FiChevronDown, FiGitMerge, FiInfo, FiTrash2 } from 'react-icons/fi';
import { getDeadlineWarning, getQuickDeadline, isOverdue } from '@/utils/deadlineUtils';
import { getMemberWorkload } from '@/services/workloadService';
import { formatSourceEvidence } from '@/utils/sourceEvidenceUtils';

export default function SuggestedTaskCard({
  task,
  workspaceMembers,
  workspaceTeams,
  canEdit,
  onUpdate,
  onToggle,
  onRemove,
  workspaceTasks = [],
  onMergeDuplicate,
  onKeepSeparate,
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const needsConfirmation = Boolean(task.approved || task.selected) && (!task.assigneeId || !task.deadline);
  const confidence = Number(task.confidenceScore ?? task.confidence ?? 0);
  const needsReview = !Number.isFinite(confidence) || confidence < 0.65;
  const evidence = useMemo(() => formatSourceEvidence(task), [task]);
  const deadlineWarning = getSuggestedDeadlineNotice(task);
  const workload = useMemo(() => {
    if (!task.assigneeId) return null;
    return getMemberWorkload(workspaceTasks, workspaceMembers).find((item) => item.userId === task.assigneeId) || null;
  }, [task.assigneeId, workspaceMembers, workspaceTasks]);

  return (
    <article className={`border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900/80 ${taskAccent(task.priority)} ${task.approved || task.selected ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
          checked={Boolean(task.approved || task.selected)}
          disabled={!canEdit}
          onChange={onToggle}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className={`rounded-md px-2 py-1 text-[10px] font-black ${priorityClass(task.priority)}`}>
              {task.priority || 'MEDIUM'}
            </span>
            {needsReview && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <FiAlertTriangle className="h-3 w-3" />
                Needs review
              </span>
            )}
            {needsConfirmation && (
              <span className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-black text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                Need confirmation
              </span>
            )}
            {deadlineWarning && (
              <span className={`rounded-md px-2 py-1 text-[10px] font-black ${deadlineWarning.tone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                {deadlineWarning.label}
              </span>
            )}
            {workload?.overloaded ? (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                This member may be overloaded
              </span>
            ) : null}
            {task.possibleDuplicate ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <FiGitMerge className="h-3 w-3" />
                Possible duplicate found
              </span>
            ) : null}
          </div>

          <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Task title
            <input
              value={task.title || ''}
              disabled={!canEdit}
              onChange={(event) => onUpdate({ title: event.target.value })}
              className="mt-1 w-full border-b border-slate-200 bg-transparent px-0 py-2 text-base font-black text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:text-slate-100 dark:focus:border-blue-500"
            />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Task brief
            <textarea
              value={task.description || ''}
              disabled={!canEdit}
              onChange={(event) => onUpdate({ description: event.target.value })}
              className="mt-1 w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-6 text-slate-600 outline-none focus:ring-0 dark:text-slate-400"
              rows={2}
            />
          </label>
          {!task.assigneeId && task.assignee ? (
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              AI suggested assignee: <span className="text-blue-600 dark:text-blue-400">{task.assignee}</span>
            </p>
          ) : null}

          <div className="grid gap-3 border-y border-slate-100 py-3 dark:border-slate-800 md:grid-cols-5">
            <FieldLabel label="Assignee">
              <select
                value={task.assigneeId || ''}
                disabled={!canEdit}
                onChange={(event) => onUpdate({ assigneeId: event.target.value || null })}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              >
                <option value="">Need confirmation</option>
                {workspaceMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.nickname || 'Unknown'} - {getActiveCount(workspaceTasks, member.userId)} active tasks
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Team">
              <select
                value={task.teamId || ''}
                disabled={!canEdit}
                onChange={(event) => onUpdate({ teamId: event.target.value || null })}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              >
                <option value="">No team</option>
                {workspaceTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Start date">
              <input
                type="date"
                value={task.startDate || ''}
                disabled={!canEdit}
                onChange={(event) => onUpdate({ startDate: event.target.value || null })}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </FieldLabel>
            <FieldLabel label="Deadline">
              <input
                type="date"
                min={task.startDate || undefined}
                value={task.deadline || ''}
                disabled={!canEdit}
                onChange={(event) => onUpdate({ deadline: event.target.value || null })}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </FieldLabel>
            <FieldLabel label="Priority">
              <select
                value={task.priority || 'MEDIUM'}
                disabled={!canEdit}
                onChange={(event) => onUpdate({ priority: event.target.value })}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </FieldLabel>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {[
                ['today', 'Today'],
                ['tomorrow', 'Tomorrow'],
                ['this-friday', 'This Friday'],
                ['next-week', 'Next week'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onUpdate({ deadline: getQuickDeadline(key) })}
                  className="border-b border-slate-300 px-1 py-1 text-[11px] font-black text-slate-500 transition hover:border-blue-500 hover:text-blue-700 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-400 dark:hover:text-blue-400"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {task.possibleDuplicate && task.duplicateCandidates?.length ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-900/20">
              <p className="text-xs font-black text-violet-800 dark:text-violet-400">Possible duplicate found</p>
              <div className="mt-2 space-y-2">
                {task.duplicateCandidates.map((candidate) => (
                  <div key={`${candidate.duplicateType}-${candidate.id}`} className="rounded-lg bg-white px-3 py-2 dark:bg-slate-800">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{candidate.title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                      {Math.round(candidate.similarity * 100)}% similar - {candidate.duplicateType}
                    </p>
                    {canEdit ? (
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => onMergeDuplicate?.(candidate)} className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-black text-white">Merge</button>
                        <button type="button" onClick={onKeepSeparate} className="rounded-md border border-violet-200 px-2 py-1 text-[10px] font-black text-violet-700 dark:border-violet-700 dark:text-violet-400">Keep separate</button>
                        <button type="button" onClick={onRemove} className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-black text-rose-700 dark:border-rose-700 dark:text-rose-400">Reject duplicate</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEvidenceOpen((value) => !value)}
              className="flex w-full items-center justify-between py-2 text-left text-xs font-black text-slate-600 dark:text-slate-300"
            >
              <span className="inline-flex items-center gap-2"><FiInfo className="h-3.5 w-3.5 text-blue-600" /> Why this task was created?</span>
              <FiChevronDown className={`h-3.5 w-3.5 transition ${evidenceOpen ? 'rotate-180' : ''}`} />
            </button>
            {evidenceOpen ? (
              <div className="border-t border-slate-100 py-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-400">
                {evidence.sourceMeetingTitle ? (
                  <p><span className="font-black text-slate-800 dark:text-slate-100">Source meeting:</span> {evidence.sourceMeetingTitle}</p>
                ) : null}
                {evidence.sourceTimestamp ? (
                  <p className="mt-2"><span className="font-black text-slate-800 dark:text-slate-100">At:</span> {evidence.sourceTimestamp}</p>
                ) : null}
                {evidence.reason ? (
                  <p className="mt-2"><span className="font-black text-slate-800 dark:text-slate-100">Reason:</span> {evidence.reason}</p>
                ) : null}
                <blockquote className="mt-2 border-l-2 border-blue-400 bg-blue-50/60 px-3 py-2 text-slate-600 dark:border-blue-600 dark:bg-blue-950/20 dark:text-slate-400">
                  {evidence.sourceQuote}
                </blockquote>
              </div>
            ) : null}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="Remove suggestion"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function getActiveCount(tasks, userId) {
  return tasks.filter((task) => task.assigneeId === userId && ['TODO', 'IN_PROGRESS', 'REVIEW'].includes(task.status) && !task.deletedAt).length;
}

function FieldLabel({ label, children }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function priorityClass(priority) {
  if (priority === 'URGENT') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (priority === 'HIGH') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  if (priority === 'LOW') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
}

function taskAccent(priority) {
  if (priority === 'URGENT') return 'border-l-red-500';
  if (priority === 'HIGH') return 'border-l-orange-500';
  if (priority === 'LOW') return 'border-l-slate-400';
  return 'border-l-amber-500';
}

function getSuggestedDeadlineNotice(task) {
  if (!(task.approved || task.selected) || !task.deadline) return null;
  if (task.deadline && isOverdue(task.deadline)) {
    return { label: 'Past date detected - choose a new deadline', tone: 'amber' };
  }
  return getDeadlineWarning(task.deadline);
}
