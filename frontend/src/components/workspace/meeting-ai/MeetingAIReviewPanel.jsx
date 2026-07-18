import { useMemo, useRef, useState } from 'react';
import { FiBriefcase, FiCheckCircle, FiClock, FiFileText, FiMic, FiUsers, FiZap } from 'react-icons/fi';
import SuggestedTaskCard from './SuggestedTaskCard';
import { buildMeetingTimeline, timestampToSeconds } from '@/services/meetingTimelineService';

const statusLabels = {
  DRAFT: 'Draft',
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  AI_REVIEW_READY: 'AI Review Ready',
  TASKS_GENERATED: 'Tasks Generated',
  COMPLETED: 'Completed',
};

const statusStyles = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  UPLOADED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  PROCESSING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  AI_REVIEW_READY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TASKS_GENERATED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export default function MeetingAIReviewPanel({
  meeting,
  workspaceTeams,
  workspaceMembers,
  workspaceTasks = [],
  activeSection,
  onSectionChange,
  onUpdateSuggestion,
  onToggleSuggestion,
  onRemoveSuggestion,
  onCreateSelectedTasks,
  canManageMeetings,
}) {
  const team = workspaceTeams.find((item) => item.id === meeting.teamId);
  const suggestedTasks = meeting.suggestedTasks || [];
  const selectedTaskCount = suggestedTasks.filter((task) => task.approved || task.selected).length;
  const reviewTaskCount = suggestedTasks.filter((task) => Number(task.confidenceScore ?? task.confidence ?? 0) < 0.65).length;
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const audioRef = useRef(null);
  const transcript = meeting.transcript || meeting.transcriptText || '';
  const visibleTranscript = useMemo(() => {
    if (showFullTranscript || transcript.length <= 5000) return transcript;
    return transcript.slice(0, 5000);
  }, [showFullTranscript, transcript]);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden border border-slate-300/80 bg-[#edf1f4] px-5 py-5 shadow-[0_16px_40px_rgba(71,85,105,0.10)] dark:border-white/10 dark:bg-[#0b1017] dark:shadow-[0_16px_40px_rgba(0,0,0,0.24)] sm:px-6">
        <span className="absolute left-0 top-0 h-px w-24 bg-[#ff6b35]" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className={`inline-flex border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${statusStyles[meeting.status] || statusStyles.UPLOADED}`}>
              {statusLabels[meeting.status] || meeting.status}
            </span>
            <h2 className="mt-3 max-w-4xl text-xl font-black text-slate-900 dark:text-white sm:text-2xl">{meeting.title}</h2>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1"><FiBriefcase />{team?.name || 'Workspace-wide'}</span>
              <span className="flex items-center gap-1"><FiUsers />{meeting.participantIds?.length || meeting.participants?.length || 0} participants</span>
              <span className="flex items-center gap-1"><FiClock />{formatDate(meeting.createdAt)}</span>
              <span className="flex items-center gap-1">{meeting.type === 'AUDIO' ? <FiMic /> : <FiFileText />}{meeting.fileName || meeting.type}</span>
            </div>
          </div>
          {meeting.status === 'AI_REVIEW_READY' && canManageMeetings && (
            <button
              type="button"
            onClick={onCreateSelectedTasks}
            className="shrink-0 rounded-sm bg-[#ff5824] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-sm shadow-[#ff5824]/25 transition hover:bg-[#ef4518] focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/50"
          >
              {selectedTaskCount ? `Create ${selectedTaskCount} Selected Tasks` : 'Create Selected Tasks'}
            </button>
          )}
        </div>
        <div className="mt-5 flex gap-5 overflow-x-auto border-t border-slate-300/80 pt-1 dark:border-white/10">
          {['overview', 'timeline', 'transcript', 'summary', 'suggested'].map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => onSectionChange(section)}
              className={`shrink-0 border-b-2 py-3 text-xs font-black capitalize transition ${
                activeSection === section
                  ? 'border-[#ff5824] text-orange-700 dark:text-[#ffb38e]'
                  : 'border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-800 dark:hover:border-white/30 dark:hover:text-slate-200'
              }`}
            >
              {section === 'suggested' ? 'Suggested Tasks' : section}
            </button>
          ))}
        </div>
      </section>

      {activeSection === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Overview" icon={FiZap}>
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{meeting.aiSummary || meeting.summary || 'Analyze this meeting to generate AI summary.'}</p>
          </Panel>
          <ParticipantsPanel participantIds={meeting.participantIds || meeting.participants || []} members={workspaceMembers} />
        </div>
      )}

      {activeSection === 'transcript' && (
        <Panel title="Transcript" icon={FiFileText}>
          <pre className="max-h-[520px] overflow-y-auto whitespace-pre-wrap break-words border border-slate-300 bg-[#e3e9ed] p-4 font-mono text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-[#07090d] dark:text-slate-300">{visibleTranscript || 'No transcript available.'}</pre>
          {!showFullTranscript && transcript.length > visibleTranscript.length && (
            <button
              type="button"
              onClick={() => setShowFullTranscript(true)}
              className="mt-3 border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-600 transition hover:border-[#ff6b35]/60 hover:bg-orange-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-[#181313]"
            >
              Load full transcript
            </button>
          )}
        </Panel>
      )}

      {activeSection === 'timeline' && (
        <Panel title="Meeting timeline" icon={FiClock}>
          {meeting.objectUrl || meeting.audioUrl ? (
            <audio ref={audioRef} controls className="mb-4 w-full" src={meeting.objectUrl || meeting.audioUrl} />
          ) : null}
          <MeetingTimeline
            meeting={meeting}
            tasks={workspaceTasks}
            canJump={Boolean(meeting.objectUrl || meeting.audioUrl)}
            onJump={(timestamp) => {
              const seconds = timestampToSeconds(timestamp);
              if (seconds !== null && audioRef.current) {
                audioRef.current.currentTime = seconds;
                audioRef.current.play?.().catch(() => {});
              }
            }}
          />
        </Panel>
      )}

      {activeSection === 'summary' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ListPanel title="Key decisions" items={meeting.keyDecisions} />
          <ListPanel title="Risks/blockers" items={meeting.risks} tone="rose" />
          <ListPanel title="Action items" items={meeting.actionItems} tone="emerald" />
          <Panel title="AI Summary" icon={FiZap}>
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{meeting.aiSummary || meeting.summary || 'No AI summary yet.'}</p>
          </Panel>
        </div>
      )}

      {activeSection === 'suggested' && (
        <section>
          <div className="flex flex-col gap-4 border-b border-slate-300/80 pb-4 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">Review queue</p>
              <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Suggested tasks</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Review only the work AI found in this meeting before creating tasks.</p>
            </div>
            <div className="flex gap-5 text-sm">
              <Metric label="Suggestions" value={suggestedTasks.length} />
              <Metric label="Selected" value={selectedTaskCount} tone="blue" />
              {reviewTaskCount ? <Metric label="Needs review" value={reviewTaskCount} tone="amber" /> : null}
            </div>
          </div>
          {suggestedTasks.length === 0 ? (
            <p className="mt-5 border border-dashed border-slate-300 bg-[#e3e9ed] px-5 py-8 text-center text-sm font-medium text-slate-500 dark:border-white/15 dark:bg-white/[0.02]">
              No actionable task suggestions were found in this meeting.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {suggestedTasks.map((task) => (
                <SuggestedTaskCard
                  key={task.id}
                  task={task}
                  workspaceMembers={workspaceMembers}
                  workspaceTeams={workspaceTeams}
                  workspaceTasks={workspaceTasks}
                  canEdit={canManageMeetings && meeting.status === 'AI_REVIEW_READY'}
                  onUpdate={(patch) => onUpdateSuggestion(task.id, patch)}
                  onToggle={() => onToggleSuggestion(task.id)}
                  onRemove={() => onRemoveSuggestion(task.id)}
                  onMergeDuplicate={(candidate) => onUpdateSuggestion(task.id, {
                    possibleDuplicate: false,
                    duplicateResolution: 'merged',
                    duplicateCandidates: [],
                    description: `${task.description || ''}\n\nMerged duplicate candidate: ${candidate.title}`.trim(),
                  })}
                  onKeepSeparate={() => onUpdateSuggestion(task.id, {
                    possibleDuplicate: false,
                    duplicateResolution: 'kept-separate',
                  })}
                />
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
}

function MeetingTimeline({ meeting, tasks, canJump, onJump }) {
  const items = buildMeetingTimeline(meeting, tasks);
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
        Timeline will appear after the meeting has transcript or AI analysis.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.timestamp}-${index}`} className="group relative pl-8">
            <span className="absolute left-2 top-2 h-full w-px bg-slate-300 group-last:hidden dark:bg-white/10" />
            <span className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#edf1f4] bg-[#ff5824] shadow-sm shadow-[#ff5824]/30 dark:border-[#0b1017]" />
          <div className="border border-slate-300/80 bg-[#edf1f4] p-4 transition hover:border-[#ff6b35]/45 hover:bg-[#e6ebef] dark:border-white/10 dark:bg-[#0b1017] dark:hover:bg-[#10161f]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canJump}
                onClick={() => onJump(item.timestamp)}
                className="border border-[#ff6b35]/35 bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700 disabled:cursor-default disabled:border-slate-300 disabled:bg-[#e3e9ed] disabled:text-slate-500 dark:bg-[#181313] dark:text-[#ffb38e] dark:disabled:border-white/10 dark:disabled:bg-white/[0.03] dark:disabled:text-slate-600"
                title={canJump ? 'Jump audio to this timestamp' : 'Audio jump unavailable'}
              >
                {item.timestamp}
              </button>
              {item.estimated ? (
                <span className="border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">Estimated timestamp</span>
              ) : null}
              {item.speaker ? <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{item.speaker}</span> : null}
            </div>
            <h4 className="mt-2 text-sm font-black text-slate-900 dark:text-white">{item.title}</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.summary}</p>
            {item.relatedTasks?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.relatedTasks.map((task) => (
                  <span key={task.id} className="border border-slate-300 bg-[#e3e9ed] px-2 py-1 text-[10px] font-black text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    {task.title}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="border border-slate-300/80 bg-[#edf1f4] p-5 shadow-[0_12px_28px_rgba(71,85,105,0.09)] dark:border-white/10 dark:bg-[#0b1017] dark:shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#ff6b35]" />
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone = 'slate' }) {
  const valueClass = tone === 'blue'
    ? 'text-orange-700 dark:text-[#ffb38e]'
    : tone === 'amber'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-slate-900 dark:text-white';
  return (
    <div className="border-l border-slate-300 pl-3 first:border-l-0 first:pl-0 dark:border-white/10">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function ListPanel({ title, items = [], tone = 'blue' }) {
  const dot = tone === 'rose' ? 'bg-rose-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-[#ff5824]';
  return (
    <Panel title={title} icon={FiFileText}>
      {items?.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dot}`} />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-medium text-slate-500">No items yet.</p>
      )}
    </Panel>
  );
}

function ParticipantsPanel({ participantIds = [], members }) {
  return (
    <Panel title="Participants" icon={FiUsers}>
      <div className="space-y-2">
        {participantIds.map((userId) => {
          const member = members.find((item) => item.userId === userId);
          return (
            <div key={userId} className="flex items-center gap-2 border border-slate-300 bg-[#e3e9ed] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{member?.name || member?.nickname || userId}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
