import { useMemo, useRef, useState } from 'react';
import { FiBriefcase, FiCheckCircle, FiClock, FiFileText, FiMic, FiUsers, FiZap } from 'react-icons/fi';
import SuggestedTaskCard from './SuggestedTaskCard';
import MeetingGeneratedTasks from './MeetingGeneratedTasks';
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
  DRAFT: 'bg-slate-100 text-slate-600',
  UPLOADED: 'bg-slate-100 text-slate-600',
  PROCESSING: 'bg-amber-100 text-amber-700',
  AI_REVIEW_READY: 'bg-blue-100 text-blue-700',
  TASKS_GENERATED: 'bg-violet-100 text-violet-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

export default function MeetingAIReviewPanel({
  meeting,
  workspaceTeams,
  workspaceMembers,
  workspaceTasks = [],
  generatedTasks,
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
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const audioRef = useRef(null);
  const transcript = meeting.transcript || meeting.transcriptText || '';
  const visibleTranscript = useMemo(() => {
    if (showFullTranscript || transcript.length <= 5000) return transcript;
    return transcript.slice(0, 5000);
  }, [showFullTranscript, transcript]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusStyles[meeting.status] || statusStyles.UPLOADED}`}>
              {statusLabels[meeting.status] || meeting.status}
            </span>
            <h2 className="mt-3 text-2xl font-black text-slate-950">{meeting.title}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
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
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
            >
              Create Selected Tasks
            </button>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {['overview', 'timeline', 'transcript', 'summary', 'suggested', 'generated'].map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => onSectionChange(section)}
              className={`rounded-full px-3.5 py-2 text-xs font-black capitalize transition ${
                activeSection === section ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {section === 'suggested' ? 'Suggested Tasks' : section === 'generated' ? 'Generated Tasks' : section}
            </button>
          ))}
        </div>
      </section>

      {activeSection === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Overview" icon={FiZap}>
            <p className="text-sm leading-7 text-slate-600">{meeting.aiSummary || meeting.summary || 'Analyze this meeting to generate AI summary.'}</p>
          </Panel>
          <ParticipantsPanel participantIds={meeting.participantIds || meeting.participants || []} members={workspaceMembers} />
        </div>
      )}

      {activeSection === 'transcript' && (
        <Panel title="Transcript" icon={FiFileText}>
          <pre className="max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{visibleTranscript || 'No transcript available.'}</pre>
          {!showFullTranscript && transcript.length > visibleTranscript.length && (
            <button
              type="button"
              onClick={() => setShowFullTranscript(true)}
              className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-50"
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
            tasks={generatedTasks}
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
            <p className="text-sm leading-7 text-slate-600">{meeting.aiSummary || meeting.summary || 'No AI summary yet.'}</p>
          </Panel>
        </div>
      )}

      {activeSection === 'suggested' && (
        <Panel title={`Suggested tasks (${suggestedTasks.length})`} icon={FiCheckCircle}>
          {suggestedTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-medium text-slate-400">
              Suggested tasks will appear after AI analysis.
            </p>
          ) : (
            <div className="space-y-3">
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
        </Panel>
      )}

      {activeSection === 'generated' && (
        <Panel title={`Generated tasks (${generatedTasks.length})`} icon={FiCheckCircle}>
          <MeetingGeneratedTasks tasks={generatedTasks} />
        </Panel>
      )}
    </div>
  );
}

function MeetingTimeline({ meeting, tasks, canJump, onJump }) {
  const items = buildMeetingTimeline(meeting, tasks);
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-medium text-slate-400">
        Timeline will appear after the meeting has transcript or AI analysis.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.timestamp}-${index}`} className="group relative pl-8">
          <span className="absolute left-2 top-2 h-full w-px bg-slate-200 group-last:hidden" />
          <span className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-sm shadow-blue-500/30" />
          <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canJump}
                onClick={() => onJump(item.timestamp)}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
                title={canJump ? 'Jump audio to this timestamp' : 'Audio jump unavailable'}
              >
                {item.timestamp}
              </button>
              {item.estimated ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">Estimated timestamp</span>
              ) : null}
              {item.speaker ? <span className="text-xs font-bold text-slate-400">{item.speaker}</span> : null}
            </div>
            <h4 className="mt-2 text-sm font-black text-slate-900">{item.title}</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
            {item.relatedTasks?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.relatedTasks.map((task) => (
                  <span key={task.id} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ListPanel({ title, items = [], tone = 'blue' }) {
  const dot = tone === 'rose' ? 'bg-rose-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500';
  return (
    <Panel title={title} icon={FiFileText}>
      {items?.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-6 text-slate-600">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dot}`} />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-medium text-slate-400">No items yet.</p>
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
            <div key={userId} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm font-bold text-slate-700">{member?.name || member?.nickname || userId}</span>
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
