import { useMemo, useState } from 'react';
import { FiAlertTriangle, FiChevronDown, FiGitMerge, FiInfo, FiTrash2 } from 'react-icons/fi';
import { getDeadlineWarning, getQuickDeadline } from '@/utils/deadlineUtils';
import { getMemberWorkload } from '@/services/workloadService';
import { formatConfidenceText, formatSourceEvidence } from '@/utils/sourceEvidenceUtils';

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
  const needsConfirmation = !task.assigneeId || !task.deadline;
  const confidence = Number(task.confidenceScore ?? task.confidence ?? 0);
  const needsReview = !Number.isFinite(confidence) || confidence < 0.8;
  const evidence = useMemo(() => formatSourceEvidence(task), [task]);
  const deadlineWarning = getDeadlineWarning(task.deadline);
  const workload = useMemo(() => {
    if (!task.assigneeId) return null;
    return getMemberWorkload(workspaceTasks, workspaceMembers).find((item) => item.userId === task.assigneeId) || null;
  }, [task.assigneeId, workspaceMembers, workspaceTasks]);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
          checked={Boolean(task.approved || task.selected)}
          disabled={!canEdit}
          onChange={onToggle}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${priorityClass(task.priority)}`}>
              {task.priority || 'MEDIUM'}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
              AI Generated - {formatConfidenceText(evidence)}
            </span>
            {needsReview && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
                <FiAlertTriangle className="h-3 w-3" />
                Needs review
              </span>
            )}
            {needsConfirmation && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-700">
                Need confirmation
              </span>
            )}
            {deadlineWarning && (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${deadlineWarning.tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {deadlineWarning.label}
              </span>
            )}
            {workload?.overloaded ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
                This member may be overloaded
              </span>
            ) : null}
            {task.possibleDuplicate ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-700">
                <FiGitMerge className="h-3 w-3" />
                Possible duplicate found
              </span>
            ) : null}
          </div>

          <input
            value={task.title}
            disabled={!canEdit}
            onChange={(event) => onUpdate({ title: event.target.value })}
            className="w-full rounded-lg border border-transparent bg-transparent text-sm font-black text-slate-900 outline-none focus:border-blue-200 focus:bg-blue-50 focus:px-2 focus:py-1"
          />
          <textarea
            value={task.description || ''}
            disabled={!canEdit}
            onChange={(event) => onUpdate({ description: event.target.value })}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 outline-none focus:border-blue-300"
            rows={2}
          />

          <div className="grid gap-2 md:grid-cols-4">
            <select
              value={task.assigneeId || ''}
              disabled={!canEdit}
              onChange={(event) => onUpdate({ assigneeId: event.target.value || null })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600"
            >
              <option value="">Need confirmation</option>
              {workspaceMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name || member.nickname || 'Unknown'} - {getActiveCount(workspaceTasks, member.userId)} active tasks
                </option>
              ))}
            </select>
            <select
              value={task.teamId || ''}
              disabled={!canEdit}
              onChange={(event) => onUpdate({ teamId: event.target.value || null })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600"
            >
              <option value="">No team</option>
              {workspaceTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={task.deadline || ''}
              disabled={!canEdit}
              onChange={(event) => onUpdate({ deadline: event.target.value || null })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600"
            />
            <select
              value={task.priority || 'MEDIUM'}
              disabled={!canEdit}
              onChange={(event) => onUpdate({ priority: event.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
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
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-500 transition hover:bg-slate-50"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {task.possibleDuplicate && task.duplicateCandidates?.length ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
              <p className="text-xs font-black text-violet-800">Possible duplicate found</p>
              <div className="mt-2 space-y-2">
                {task.duplicateCandidates.map((candidate) => (
                  <div key={`${candidate.duplicateType}-${candidate.id}`} className="rounded-lg bg-white px-3 py-2">
                    <p className="text-xs font-bold text-slate-700">{candidate.title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-violet-600">
                      {Math.round(candidate.similarity * 100)}% similar - {candidate.duplicateType}
                    </p>
                    {canEdit ? (
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => onMergeDuplicate?.(candidate)} className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-black text-white">Merge</button>
                        <button type="button" onClick={onKeepSeparate} className="rounded-md border border-violet-200 px-2 py-1 text-[10px] font-black text-violet-700">Keep separate</button>
                        <button type="button" onClick={onRemove} className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-black text-rose-700">Reject duplicate</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setEvidenceOpen((value) => !value)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-black text-slate-700"
            >
              <span className="inline-flex items-center gap-2"><FiInfo className="h-3.5 w-3.5 text-blue-600" /> Why this task was created?</span>
              <FiChevronDown className={`h-3.5 w-3.5 transition ${evidenceOpen ? 'rotate-180' : ''}`} />
            </button>
            {evidenceOpen ? (
              <div className="border-t border-slate-200 px-3 py-3 text-xs leading-5 text-slate-600">
                {evidence.sourceMeetingTitle ? (
                  <p><span className="font-black text-slate-800">Source meeting:</span> {evidence.sourceMeetingTitle}</p>
                ) : null}
                {evidence.sourceTimestamp ? (
                  <p className="mt-2"><span className="font-black text-slate-800">At:</span> {evidence.sourceTimestamp}</p>
                ) : null}
                {evidence.reason ? (
                  <p className="mt-2"><span className="font-black text-slate-800">Reason:</span> {evidence.reason}</p>
                ) : null}
                <blockquote className="mt-2 rounded-lg border-l-4 border-blue-300 bg-white px-3 py-2 text-slate-600">
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
            className="rounded-lg p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
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

function priorityClass(priority) {
  if (priority === 'URGENT') return 'bg-red-100 text-red-700';
  if (priority === 'HIGH') return 'bg-orange-100 text-orange-700';
  if (priority === 'LOW') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-100 text-amber-700';
}
