import { FiCheckCircle } from 'react-icons/fi';
import { formatConfidenceText, formatSourceEvidence, safeText } from '@/utils/sourceEvidenceUtils';

export default function MeetingGeneratedTasks({ tasks }) {
  if (!tasks?.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
        No official tasks created from this meeting yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {tasks.map((task) => {
        const evidence = formatSourceEvidence(task);
        return (
          <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-start gap-2">
              <FiCheckCircle className="mt-0.5 h-4 w-4 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">{safeText(task.title, 'Untitled task')}</p>
                  {task.generatedFromAI ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      AI Generated
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">
                  {safeText(task.status, 'Task')} - {safeText(task.priority, 'Medium')}
                </p>
                {task.generatedFromAI ? (
                  <p className="mt-2 text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    {formatConfidenceText(evidence)}
                  </p>
                ) : null}
                {(task.sourceMeetingId || evidence.sourceMeetingTitle || task.generatedFromAI) ? (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-400">
                    <p>
                      <span className="font-black text-slate-800 dark:text-slate-100">Source meeting:</span>{' '}
                      {evidence.sourceMeetingTitle || 'Linked meeting'}
                    </p>
                    {evidence.sourceTimestamp ? (
                      <p className="font-bold text-blue-600 dark:text-blue-400">At {evidence.sourceTimestamp}</p>
                    ) : null}
                    <details className="mt-2">
                      <summary className="cursor-pointer font-black text-slate-700 dark:text-slate-300">
                        Why this task was created?
                      </summary>
                      {evidence.reason ? (
                        <p className="mt-2">
                          <span className="font-black text-slate-800 dark:text-slate-100">Reason:</span> {evidence.reason}
                        </p>
                      ) : null}
                      <blockquote className="mt-2 rounded-md border-l-4 border-blue-300 bg-blue-50 px-3 py-2 text-slate-600 dark:border-blue-700 dark:bg-blue-900/20 dark:text-slate-400">
                        {evidence.sourceQuote}
                      </blockquote>
                    </details>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
