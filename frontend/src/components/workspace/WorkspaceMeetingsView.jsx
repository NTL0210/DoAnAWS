import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiTrash2, FiZap } from 'react-icons/fi';
import { useWorkspace } from '@/context/WorkspaceContext';
import MeetingUploadPanel from '@/components/workspace/meeting-ai/MeetingUploadPanel';
import MeetingProcessingState from '@/components/workspace/meeting-ai/MeetingProcessingState';
import MeetingAIReviewPanel from '@/components/workspace/meeting-ai/MeetingAIReviewPanel';
import useProcessingJobPolling from '@/hooks/useProcessingJobPolling';
import {
  getWorkspacePlan,
  getWorkspaceUsageSnapshot,
  validateMeetingProcessing,
} from '@/services/billingService';

const statusLabels = {
  DRAFT: 'Draft',
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  AI_REVIEW_READY: 'AI Review Ready',
  TASKS_GENERATED: 'Tasks Generated',
  COMPLETED: 'Completed',
};

const statusStyles = {
  DRAFT: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  UPLOADED: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  PROCESSING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  AI_REVIEW_READY: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  TASKS_GENERATED: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};

export default function WorkspaceMeetingsView() {
  const {
    activeWorkspace,
    workspaceRole,
    workspaceTeams,
    workspaceMembers,
    workspaceTasks,
    meetings,
    createMeeting,
    deleteMeeting,
    uploadMeetingMock,
    analyzeMeetingWithAI,
    updateSuggestedTask,
    toggleSuggestedTaskSelection,
    removeMeetingSuggestion,
    createTasksFromSuggestions,
    getTasksByMeeting,
    selectView,
    reAnalyzeMeeting,
  } = useWorkspace();

  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [processingMeetingId, setProcessingMeetingId] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('overview');
  const [error, setError] = useState('');

  // Processing job polling
  const processingJob = useProcessingJobPolling(null, {
    meetingId: processingMeetingId,
    enabled: Boolean(processingMeetingId),
    onComplete: () => setProcessingMeetingId(null),
    onError: (err) => {
      setError(err);
      setProcessingMeetingId(null);
    },
  });

  const workspaceMeetings = useMemo(
    () => (meetings || []).filter((meeting) => meeting.workspaceId === activeWorkspace?.id && !meeting.deletedAt),
    [meetings, activeWorkspace]
  );

  const selectedMeeting = useMemo(
    () => workspaceMeetings.find((meeting) => meeting.id === selectedMeetingId) || workspaceMeetings[0] || null,
    [workspaceMeetings, selectedMeetingId]
  );

  const generatedTasks = selectedMeeting ? getTasksByMeeting(selectedMeeting.id) : [];
  const canManageMeetings = ['OWNER', 'VICE_ADMIN', 'MANAGER'].includes(workspaceRole);
  const billingPlan = getWorkspacePlan(activeWorkspace);
  const billingUsage = getWorkspaceUsageSnapshot({
    workspace: activeWorkspace,
    meetings,
    members: workspaceMembers,
  });

  useEffect(() => {
    if (!processingMeetingId) {
      setProcessingProgress(0);
      return undefined;
    }
    setProcessingProgress(8);
    const timer = setInterval(() => {
      setProcessingProgress((prev) => Math.min(92, prev + (prev < 45 ? 14 : prev < 75 ? 8 : 3)));
    }, 450);
    return () => clearInterval(timer);
  }, [processingMeetingId]);

  // Whether the selected meeting has already been analyzed
  const canReAnalyze =
    selectedMeeting &&
    ['AI_REVIEW_READY', 'TASKS_GENERATED', 'COMPLETED'].includes(selectedMeeting.status) &&
    !processingMeetingId;

  const handleAnalyze = async (payload) => {
    setError('');
    const planGuard = validateMeetingProcessing({
      plan: billingPlan,
      usage: billingUsage,
      file: payload.file,
    });
    if (!planGuard.allowed) {
      setError(planGuard.message);
      return;
    }

    const meeting = createMeeting({
      ...payload,
      audioMinutes: planGuard.estimatedMinutes,
      fileSize: payload.file?.size || 0,
    });
    if (!meeting) {
      setError('Unable to create meeting. Please check title and workspace.');
      return;
    }

    setSelectedMeetingId(meeting.id);
    setActiveSection('overview');
    setProcessingMeetingId(meeting.id);

    if (payload.file) {
      await uploadMeetingMock(meeting.id, payload.file);
    }
    await analyzeMeetingWithAI(meeting);
    setProcessingMeetingId(null);
    setProcessingProgress(100);
    setActiveSection('summary');
  };

  const handleReAnalyze = async () => {
    if (!selectedMeeting) return;
    setError('');
    setProcessingMeetingId(selectedMeeting.id);
    setActiveSection('overview');

    try {
      await reAnalyzeMeeting(selectedMeeting.id);
    } catch (err) {
      setError(err.message || 'Re-analysis failed.');
    }

    setProcessingMeetingId(null);
    setProcessingProgress(100);
    setActiveSection('summary');
  };

  const handleCreateSelectedTasks = () => {
    if (!selectedMeeting) return;
    const selectedIds = (selectedMeeting.suggestedTasks || [])
      .filter((task) => task.approved || task.selected)
      .map((task) => task.id);
    const created = createTasksFromSuggestions(selectedMeeting.id, selectedIds);
    if (created.length > 0) {
      setActiveSection('generated');
      selectView('tasks');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-5 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-400">
            <FiZap className="h-4 w-4" />
            AI Suggested Tasks Review Flow
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">Meetings become reviewed work</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            AI only suggests tasks. Managers edit, select, and approve before official tasks are created.
          </p>
        </header>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300">
            <FiAlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <div className="space-y-5">
            <MeetingUploadPanel
              workspaceTeams={workspaceTeams}
              workspaceMembers={workspaceMembers}
              canManageMeetings={canManageMeetings}
              onAnalyze={handleAnalyze}
              processing={Boolean(processingMeetingId)}
              billingPlan={billingPlan}
              usage={billingUsage}
            />
            <MeetingList
              meetings={workspaceMeetings}
              selectedMeetingId={selectedMeeting?.id}
              canManageMeetings={canManageMeetings}
              onSelect={(meetingId) => {
                setSelectedMeetingId(meetingId);
                setActiveSection('overview');
              }}
              onDelete={(meetingId) => {
                deleteMeeting(meetingId);
                if (selectedMeetingId === meetingId) {
                  setSelectedMeetingId(null);
                  setActiveSection('overview');
                }
              }}
            />
          </div>

          <div className="min-w-0">
            {processingMeetingId ? (
              <MeetingProcessingState
                progress={processingProgress}
                status={processingJob.status || 'PROCESSING'}
                onCancel={() => {
                  processingJob.cancel?.();
                  setProcessingMeetingId(null);
                }}
                onRetry={handleReAnalyze}
              />
            ) : selectedMeeting ? (
              <div>
                {canReAnalyze && (
                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleReAnalyze}
                      className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 transition hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    >
                      <FiRefreshCw className="h-3.5 w-3.5" />
                      Re-analyze with AI
                    </button>
                  </div>
                )}
                <MeetingAIReviewPanel
                  meeting={selectedMeeting}
                  workspaceTeams={workspaceTeams}
                  workspaceMembers={workspaceMembers}
                  workspaceTasks={workspaceTasks}
                  generatedTasks={generatedTasks}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
                  onUpdateSuggestion={(suggestionId, patch) => updateSuggestedTask(selectedMeeting.id, suggestionId, patch)}
                  onToggleSuggestion={(suggestionId) => toggleSuggestedTaskSelection(selectedMeeting.id, suggestionId)}
                  onRemoveSuggestion={(suggestionId) => removeMeetingSuggestion(selectedMeeting.id, suggestionId)}
                  onCreateSelectedTasks={handleCreateSelectedTasks}
                  canManageMeetings={canManageMeetings}
                />
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MeetingList({ meetings, selectedMeetingId, canManageMeetings, onSelect, onDelete }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-950 dark:text-slate-100">Meeting history</h2>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-black text-slate-500 dark:text-slate-400">{meetings.length}</span>
      </div>
      {meetings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-5 text-center text-sm font-medium text-slate-400 dark:text-slate-500">
          No meetings yet.
        </p>
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                selectedMeetingId === meeting.id ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <button type="button" onClick={() => onSelect(meeting.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-black text-slate-800 dark:text-slate-200">{meeting.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${statusStyles[meeting.status] || statusStyles.UPLOADED}`}>
                    {statusLabels[meeting.status] || meeting.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">{formatDate(meeting.createdAt)}</p>
              </button>
              {canManageMeetings ? (
                <button
                  type="button"
                  onClick={() => onDelete(meeting.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-100 dark:border-red-900/30 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-black text-red-500 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                  Move to Trash
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-8 text-center">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">No meeting selected</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          Create a meeting and run AI analysis to review suggested tasks.
        </p>
      </div>
    </section>
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
