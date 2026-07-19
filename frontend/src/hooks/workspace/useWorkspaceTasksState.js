'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { generateId } from '@/lib/workspaceData';
import { analyzeMeeting as serviceAnalyzeMeeting, createMeeting as serviceCreateMeeting, deleteMeeting as serviceDeleteMeeting, updateMeeting as serviceUpdateMeeting, uploadMeetingFile as serviceUploadMeetingFile } from '@/services/meetingService';
import { getTasksByMeeting as filterTasksByMeeting } from '@/services/taskService';
import { isCloudMode } from '@/services/apiClient';
import { resolveSuggestedTaskAssignees } from '@/utils/assigneeUtils';
import { getDeadlineCountdown, getDeadlineDateLabel, getDeadlineRemainingDays } from '@/utils/deadlineUtils';
import { getGlobalSocket } from '@/context/VoiceConnectionContext';

const EMPTY_TRASH = { tasks: [], meetings: [], teams: [] };
function normalizeTaskForUi(task) {
  const status = isIncompleteAfterDeadline(task) ? 'OVERDUE' : task.status || 'PENDING';
  return {
    ...task,
    status,
    progress: status === 'OVERDUE' ? Math.min(task.progress || 0, 99) : task.progress,
    departmentId: task.departmentId || task.workspaceId,
  };
}

function isIncompleteAfterDeadline(task) {
  if (!task?.deadline || ['COMPLETED', 'REVIEW', 'CANCELLED'].includes(task.status)) return false;
  const deadlineDate = new Date(task.deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;
  return deadlineDate < new Date();
}

function normalizeMeetingForUi(meeting, activeWorkspaceId, currentUserId, workspaceMembers = []) {
  const suggestions = resolveSuggestedTaskAssignees(
    meeting.suggestions || meeting.suggestedTasks || [],
    workspaceMembers,
    currentUserId
  );
  return {
    ...meeting,
    departmentId: meeting.departmentId || meeting.workspaceId || activeWorkspaceId,
    uploadedBy: meeting.uploadedBy || meeting.createdBy || currentUserId,
    suggestions,
    suggestedTasks: suggestions,
  };
}

function getMeetingSuggestions(meeting) {
  return meeting?.suggestedTasks || meeting?.suggestions || [];
}

function withMeetingSuggestions(meeting, suggestedTasks) {
  return { ...meeting, suggestedTasks, suggestions: suggestedTasks };
}

/**
 * useWorkspaceTasksState â€” manages workspace tasks, meetings, trash, and AI workflow actions.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @param {Object|null} params.activeWorkspace
 * @param {string|null} params.workspaceRole
 * @param {boolean} params.canManageAIReview
 * @param {Array} params.workspaceMembers
 * @param {string|null} params.activeWorkspaceId
 * @param {Function} params.setWorkspaces
 * @param {Function} params.addActivity
 * @param {Function} params.addNotification
 * @param {Function} params.showToast
 * @param {Function} params.completeOnboardingStep
 * @returns {{
 *   workspaceTasks: Array,
 *   setWorkspaceTasks: Function,
 *   workspaceMeetings: Array,
 *   setWorkspaceMeetings: Function,
 *   trashItems: Object,
 *   setTrashItems: Function,
 *   // Task actions
 *   addWorkspaceTasks: (newTasks: Array) => void,
 *   moveWorkspaceTask: (taskId: string, newStatus: string) => void,
 *   // Meeting actions
 *   createMeeting: (meetingData: Object) => Object|null,
 *   uploadMeetingFile: (meetingId: string, file: Object) => Promise<void>,
 *   processMeetingWithAI: (meetingOrId: Object|string) => Promise<void>,
 *   analyzeMeetingWithAI: (meetingOrId: Object|string) => Promise<void>,
 *   updateMeetingSuggestion: (meetingId: string, suggestionId: string, patch: Object) => void,
 *   updateSuggestedTask: (meetingId: string, suggestionId: string, patch: Object) => void,
 *   toggleSuggestedTaskSelection: (meetingId: string, suggestionId: string) => void,
 *   removeMeetingSuggestion: (meetingId: string, suggestionId: string) => void,
 *   createTasksFromMeeting: (meetingId: string, selectedSuggestedTaskIds?: Array) => Promise<void>,
 *   createTasksFromSuggestions: (meetingId: string, selectedSuggestedTaskIds?: Array) => Promise<void>,
 *   getTasksByMeeting: (meetingId: string) => Array,
 *   // Trash
 *   restoreTrashItem: (type: string, id: string) => void,
 *   permanentlyDeleteTrashItem: (type: string, id: string) => void,
 * }}
 */
export default function useWorkspaceTasksState({
  currentUser,
  activeWorkspace,
  workspaceRole,
  canManageAIReview,
  workspaceMembers,
  activeWorkspaceId,
  setWorkspaces,
  addActivity,
  addNotification,
  showToast,
  completeOnboardingStep,
}) {
  const [workspaceTasks, setWorkspaceTasks] = useState([]);
  const [workspaceMeetings, setWorkspaceMeetings] = useState([]);
  const [trashItems, setTrashItems] = useState(EMPTY_TRASH);
  const suggestionSaveTimersRef = useRef(new Map());
  const suggestionDraftsRef = useRef(new Map());
  const emittedTaskNotificationsRef = useRef(new Set());
  const taskRefreshSequenceRef = useRef(0);

  useEffect(() => () => {
    suggestionSaveTimersRef.current.forEach((timer) => clearTimeout(timer));
  }, []);

  const applyWorkspaceTasks = useCallback((tasks) => {
      const normalizedTasks = tasks.map(normalizeTaskForUi);
      setWorkspaceTasks(normalizedTasks);

      normalizedTasks.forEach((task) => {
        const teamName = getTaskTeamName(task, activeWorkspace);
        const reviewKey = `review:${task.id}`;
        if (canManageAIReview && task.status === 'REVIEW' && !emittedTaskNotificationsRef.current.has(reviewKey)) {
          emittedTaskNotificationsRef.current.add(reviewKey);
          addNotification?.(
            'TASK_REVIEW_REQUIRED',
            'Task ready for review',
            `${task.title} · ${teamName}`,
            { taskId: task.id, teamId: task.teamId, workspaceId: activeWorkspaceId },
          );
        }

        if (task.assigneeId !== currentUser.id || ['COMPLETED', 'CANCELLED'].includes(task.status)) return;
        const createdRecently = task.createdAt && Date.now() - new Date(task.createdAt).getTime() <= 24 * 60 * 60 * 1000;
        const assignmentKey = `assigned:${task.id}`;
        if (task.status === 'PENDING' && createdRecently && !emittedTaskNotificationsRef.current.has(assignmentKey)) {
          emittedTaskNotificationsRef.current.add(assignmentKey);
          addNotification?.(
            'TASK_ASSIGNED',
            'New task assigned',
            `${task.title} · ${teamName}`,
            { taskId: task.id, teamId: task.teamId, workspaceId: activeWorkspaceId },
          );
        }

        const remainingDays = getDeadlineRemainingDays(task.deadline);
        if (remainingDays === null || remainingDays > 3) return;
        const deadlineKey = `deadline:${task.id}:${remainingDays < 0 ? 'overdue' : remainingDays}`;
        if (emittedTaskNotificationsRef.current.has(deadlineKey)) return;
        emittedTaskNotificationsRef.current.add(deadlineKey);
        addNotification?.(
          remainingDays < 0 ? 'TASK_OVERDUE' : 'DEADLINE_APPROACHING',
          remainingDays < 0 ? 'Task overdue' : 'Task deadline approaching',
          `${task.title} · ${teamName} · ${getDeadlineDateLabel(task.deadline)} · ${getDeadlineCountdown(task.deadline)}`,
          { taskId: task.id, teamId: task.teamId, workspaceId: activeWorkspaceId },
        );
      });
  }, [activeWorkspace, activeWorkspaceId, addNotification, canManageAIReview, currentUser?.id]);

  const fetchWorkspaceTasks = useCallback(async () => {
    const requestSequence = ++taskRefreshSequenceRef.current;
    const { tasksApi } = await import('@/services/cloudClient');
    const tasksResult = await tasksApi.list({ workspaceId: activeWorkspaceId, limit: 100 });
    if (requestSequence !== taskRefreshSequenceRef.current) return;
    const tasks = Array.isArray(tasksResult)
      ? tasksResult
      : tasksResult?.items || tasksResult?.tasks || [];
    applyWorkspaceTasks(tasks);
  }, [activeWorkspaceId, applyWorkspaceTasks]);

  const refreshWorkspaceTasks = useCallback(async ({ silent = true } = {}) => {
    if (!isCloudMode() || !activeWorkspaceId || !currentUser?.id) {
      setWorkspaceTasks([]);
      return;
    }

    try {
      await fetchWorkspaceTasks();
    } catch (err) {
      if (!silent) {
        showToast('error', err?.message || 'Failed to load workspace tasks.');
        setWorkspaceTasks([]);
      }
    }
  }, [activeWorkspaceId, currentUser?.id, fetchWorkspaceTasks, showToast]);

  const refreshWorkspaceExecutionData = useCallback(async ({ silent = false } = {}) => {
    if (!isCloudMode() || !activeWorkspaceId || !currentUser?.id) {
      setWorkspaceTasks([]);
      setWorkspaceMeetings([]);
      return;
    }

    try {
      const { meetingsApi } = await import('@/services/cloudClient');
      const [meetingsResult] = await Promise.all([
        meetingsApi.list({ workspaceId: activeWorkspaceId, limit: 100 }),
        fetchWorkspaceTasks(),
      ]);
      const meetings = Array.isArray(meetingsResult)
        ? meetingsResult
        : meetingsResult?.items || meetingsResult?.meetings || [];
      setWorkspaceMeetings(
        meetings.map((meeting) => normalizeMeetingForUi(meeting, activeWorkspaceId, currentUser.id, workspaceMembers))
      );
    } catch (err) {
      if (!silent) {
        showToast('error', err?.message || 'Failed to load workspace data.');
        setWorkspaceMeetings([]);
        setWorkspaceTasks([]);
      }
    }
  }, [activeWorkspaceId, currentUser?.id, fetchWorkspaceTasks, showToast, workspaceMembers]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceExecutionData() {
      if (cancelled) return;
      await refreshWorkspaceExecutionData();
    }

    loadWorkspaceExecutionData();
    return () => { cancelled = true; };
  }, [refreshWorkspaceExecutionData]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refreshSilently = () => refreshWorkspaceExecutionData({ silent: true });
    const refreshTasksSilently = () => refreshWorkspaceTasks({ silent: true });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshSilently();
    };
    const refreshRealtimeData = (event) => {
      if (event.detail?.workspaceId !== activeWorkspaceId) return;
      if (event.detail?.type === 'WORKSPACE_EXECUTION_CHANGED') refreshSilently();
    };
    window.addEventListener('focus', refreshSilently);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('workspace:tasks-refresh', refreshTasksSilently);
    window.addEventListener('workspace:realtime', refreshRealtimeData);
    return () => {
      window.removeEventListener('focus', refreshSilently);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('workspace:tasks-refresh', refreshTasksSilently);
      window.removeEventListener('workspace:realtime', refreshRealtimeData);
    };
  }, [activeWorkspaceId, refreshWorkspaceExecutionData, refreshWorkspaceTasks]);

  useEffect(() => {
    if (!activeWorkspaceId || !currentUser?.id || typeof window === 'undefined') return undefined;
    const refreshVisibleData = () => {
      if (document.visibilityState === 'visible') {
        refreshWorkspaceExecutionData({ silent: true });
      }
    };
    const intervalId = window.setInterval(refreshVisibleData, 5000);
    return () => window.clearInterval(intervalId);
  }, [activeWorkspaceId, currentUser?.id, refreshWorkspaceExecutionData]);

  // â”€â”€â”€ Task Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addWorkspaceTasks = useCallback(async (newTasks) => {
    if (!Array.isArray(newTasks)) return;
    if (!isCloudMode() || !activeWorkspaceId) return;

    try {
      const { tasksApi } = await import('@/services/cloudClient');
      const createdTasks = [];
      for (const task of newTasks) {
        const created = await tasksApi.create({
          workspaceId: task.workspaceId || activeWorkspaceId,
          meetingId: task.meetingId || task.sourceMeetingId || undefined,
          teamId: task.teamId || undefined,
          title: task.title,
          description: task.description || '',
          assigneeId: task.assigneeId || undefined,
          priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(task.priority) ? task.priority : 'MEDIUM',
          startDate: task.startDate || undefined,
          deadline: task.deadline || undefined,
          createdBy: currentUser?.id,
        });
        createdTasks.push(normalizeTaskForUi(created));
      }
      setWorkspaceTasks((prev) => [...createdTasks, ...prev]);
      publishExecutionChange(activeWorkspaceId, 'tasks');
      return createdTasks;
    } catch (err) {
      showToast('error', err?.message || 'Failed to create task.');
      return [];
    }
  }, [activeWorkspaceId, currentUser?.id, showToast]);

  const moveWorkspaceTask = useCallback(async (taskId, newStatus) => {
    const current = workspaceTasks.find((task) => task.id === taskId);
    if (!current) return;
    const previousStatus = current.status;

    setWorkspaceTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, status: newStatus, updatedAt: new Date().toISOString() };
      })
    );

    try {
      if (!isCloudMode()) return;
      const { tasksApi } = await import('@/services/cloudClient');
      const saved = await tasksApi.update(taskId, {
        workspaceId: current.workspaceId || activeWorkspaceId,
        status: newStatus,
        expectedVersion: current.version || 1,
      });
      setWorkspaceTasks((prev) =>
        prev.map((task) => (task.id === taskId ? normalizeTaskForUi(saved) : task))
      );
      publishExecutionChange(current.workspaceId || activeWorkspaceId, 'tasks');
    } catch (err) {
      setWorkspaceTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: previousStatus } : task
        )
      );
      showToast('error', err?.message || 'Failed to update task status.');
    }
  }, [workspaceTasks, activeWorkspaceId, showToast]);

  const deleteWorkspaceTask = useCallback(async (taskId) => {
    const task = workspaceTasks.find((item) => item.id === taskId);
    if (!task) return;
    const previousTasks = workspaceTasks;

    setWorkspaceTasks((prev) => prev.filter((item) => item.id !== taskId));

    try {
      if (!isCloudMode()) return;
      const { tasksApi } = await import('@/services/cloudClient');
      await tasksApi.delete(taskId, { workspaceId: task.workspaceId || activeWorkspaceId });
      publishExecutionChange(task.workspaceId || activeWorkspaceId, 'tasks');
    } catch (err) {
      setWorkspaceTasks(previousTasks);
      showToast('error', err?.message || 'Failed to delete task.');
    }
  }, [workspaceTasks, activeWorkspaceId, showToast]);

  // â”€â”€â”€ Meeting Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const createMeeting = useCallback(async (meetingData) => {
    const allowed = canManageAIReview || workspaceRole === 'OWNER';
    if (!activeWorkspace || !currentUser || !allowed) {
      showToast('error', 'You do not have permission to create meetings.');
      return null;
    }

    const meetingPayload = {
      workspaceId: activeWorkspaceId,
      teamId: meetingData.teamId || undefined,
      title: meetingData.title || 'Untitled Meeting',
      transcriptText: meetingData.transcriptText || meetingData.transcript || '',
      storageRef: meetingData.storageRef || undefined,
      createdBy: currentUser.id,
    };

    try {
      const saved = await serviceCreateMeeting(meetingPayload);
      const newMeeting = normalizeMeetingForUi(saved, activeWorkspaceId, currentUser.id, workspaceMembers);
      setWorkspaceMeetings((prev) => [newMeeting, ...prev]);
      publishExecutionChange(activeWorkspaceId, 'meetings');
      addActivity('meeting_created', 'Meeting "' + newMeeting.title + '" uploaded');
      showToast('success', 'Meeting created successfully.');
      completeOnboardingStep('meetingUploaded');
      return newMeeting;
    } catch (err) {
      showToast('error', err.message || 'Failed to create meeting.');
      return null;
    }
  }, [activeWorkspace, currentUser, canManageAIReview, workspaceRole, activeWorkspaceId, workspaceMembers, addActivity, showToast, completeOnboardingStep]);

  const uploadMeetingFile = useCallback(async (meetingId, file) => {
    const meeting = workspaceMeetings.find((m) => m.id === meetingId);
    try {
      const result = await serviceUploadMeetingFile(meetingId, file, {
        meetingId,
        workspaceId: meeting?.workspaceId || activeWorkspaceId,
      });
      setWorkspaceMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, ...result } : m))
      );
      publishExecutionChange(meeting?.workspaceId || activeWorkspaceId, 'meetings');
      return result;
    } catch (err) {
      showToast('error', err.message || 'Upload failed');
      throw err;
    }
  }, [workspaceMeetings, activeWorkspaceId, showToast]);

  const deleteMeeting = useCallback(async (meetingId) => {
    const meeting = workspaceMeetings.find((item) => item.id === meetingId);
    if (!meeting) return;

    setWorkspaceMeetings((prev) => prev.filter((item) => item.id !== meetingId));
    setTrashItems((prev) => ({
      ...prev,
      meetings: [{ ...meeting, deletedAt: new Date().toISOString() }, ...(prev.meetings || [])],
    }));

    try {
      await serviceDeleteMeeting(meetingId, { workspaceId: meeting.workspaceId || activeWorkspaceId });
      publishExecutionChange(meeting.workspaceId || activeWorkspaceId, 'meetings');
    } catch (err) {
      setWorkspaceMeetings((prev) => [meeting, ...prev]);
      setTrashItems((prev) => ({
        ...prev,
        meetings: (prev.meetings || []).filter((item) => item.id !== meetingId),
      }));
      showToast('error', err?.message || 'Failed to move meeting to trash.');
    }
  }, [workspaceMeetings, activeWorkspaceId, showToast]);

  const processMeetingWithAI = useCallback(async (meetingOrId) => {
    const meetingId = typeof meetingOrId === 'string' ? meetingOrId : meetingOrId?.id;
    const meeting = workspaceMeetings.find((m) => m.id === meetingId) || (typeof meetingOrId === 'object' ? meetingOrId : null);
    if (!meetingId || !meeting) {
      showToast('error', 'Meeting is not ready for AI processing yet. Please try again.');
      return;
    }

    setWorkspaceMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, status: 'PROCESSING' } : m))
    );

    try {
      const result = await serviceAnalyzeMeeting(meetingId, {
        workspaceId: meeting.workspaceId || activeWorkspaceId,
        members: workspaceMembers,
        currentUserId: currentUser?.id,
      });
      if (result?.status === 'FAILED') {
        throw new Error(result.summary || 'AI processing failed.');
      }

      const suggestions = resolveSuggestedTaskAssignees((result?.suggestedTasks || result?.tasks || []).map((task, idx) => ({
        id: task.id || 'sug-' + generateId(),
        meetingId,
        title: task.title || 'Untitled Task',
        description: task.description || '',
        assignee: task.assignee || null,
        assigneeId: task.assigneeId || null,
        deadline: task.deadline || null,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(task.priority) ? task.priority : 'MEDIUM',
        confidence: typeof task.confidence === 'number' ? task.confidence : 0.5,
        sourceQuote: task.sourceQuote || null,
        reason: task.reason || null,
        approved: false,
        order: idx,
      })), workspaceMembers, currentUser?.id);

      setWorkspaceMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                ...result,
                status: result?.status || 'COMPLETED',
                summary: result.summary || m.summary,
                suggestions,
                suggestedTasks: suggestions,
              }
            : m
        )
      );

      addActivity('ai_processing_complete', 'AI processing complete for "' + (meeting.title || 'Meeting') + '"');
      publishExecutionChange(meeting.workspaceId || activeWorkspaceId, 'meetings');
      showToast('success', 'AI processing complete for "' + (meeting.title || 'Meeting') + '". Review the extracted tasks.');
    } catch (err) {
      setWorkspaceMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, status: 'FAILED' } : m))
      );
      showToast('error', 'AI processing failed: ' + (err.message || 'Unknown error'));
    }
  }, [workspaceMeetings, activeWorkspaceId, workspaceMembers, currentUser, addActivity, showToast]);

  const analyzeMeetingWithAI = processMeetingWithAI;

  /** Re-run AI analysis on an already-processed meeting */
  const reAnalyzeMeeting = useCallback(async (meetingId) => {
    const meeting = workspaceMeetings.find((item) => item.id === meetingId);
    try {
      // Reset status to UPLOADED so postProcess accepts it
      await serviceUpdateMeeting(meetingId, {
        status: 'UPLOADED',
        workspaceId: meeting?.workspaceId || activeWorkspaceId,
      });
    } catch (err) {
      console.warn('[WorkspaceTasks] Failed to reset meeting status for re-analysis:', err);
    }
    await processMeetingWithAI(meetingId);
  }, [workspaceMeetings, activeWorkspaceId, processMeetingWithAI]);

  const saveMeetingSuggestions = useCallback((meetingId, workspaceId, suggestedTasks, extraUpdates = {}) => {
    suggestionDraftsRef.current.set(meetingId, { workspaceId, suggestedTasks, extraUpdates });
    clearTimeout(suggestionSaveTimersRef.current.get(meetingId));
    suggestionSaveTimersRef.current.set(meetingId, setTimeout(async () => {
      const draft = suggestionDraftsRef.current.get(meetingId);
      if (!draft) return;
      try {
        const { meetingsApi } = await import('@/services/cloudClient');
        await meetingsApi.update(meetingId, {
          workspaceId: draft.workspaceId || activeWorkspaceId,
          suggestedTasks: draft.suggestedTasks,
          ...draft.extraUpdates,
        });
        publishExecutionChange(draft.workspaceId || activeWorkspaceId, 'meetings');
      } catch (err) {
        showToast('error', err?.message || 'Failed to save the edited AI suggestion.');
      }
    }, 350));
  }, [activeWorkspaceId, showToast]);

  const updateMeetingSuggestion = useCallback((meetingId, suggestionId, patch) => {
    const meeting = workspaceMeetings.find((item) => item.id === meetingId);
    if (!meeting) return;
    const suggestedTasks = getMeetingSuggestions(meeting).map((suggestion) =>
      suggestion.id === suggestionId ? { ...suggestion, ...patch } : suggestion
    );
    setWorkspaceMeetings((prev) =>
      prev.map((item) => item.id === meetingId ? withMeetingSuggestions(item, suggestedTasks) : item)
    );
    saveMeetingSuggestions(meetingId, meeting.workspaceId, suggestedTasks);
  }, [workspaceMeetings, saveMeetingSuggestions]);

  const updateSuggestedTask = updateMeetingSuggestion;

  const toggleSuggestedTaskSelection = useCallback((meetingId, suggestionId) => {
    const meeting = workspaceMeetings.find((item) => item.id === meetingId);
    if (!meeting) return;
    const suggestedTasks = getMeetingSuggestions(meeting).map((suggestion) =>
      suggestion.id === suggestionId ? { ...suggestion, approved: !suggestion.approved } : suggestion
    );
    setWorkspaceMeetings((prev) =>
      prev.map((item) => item.id === meetingId ? withMeetingSuggestions(item, suggestedTasks) : item)
    );
    saveMeetingSuggestions(meetingId, meeting.workspaceId, suggestedTasks);
  }, [workspaceMeetings, saveMeetingSuggestions]);

  const removeMeetingSuggestion = useCallback((meetingId, suggestionId) => {
    const meeting = workspaceMeetings.find((item) => item.id === meetingId);
    if (!meeting) return;
    const suggestedTasks = getMeetingSuggestions(meeting).filter((suggestion) => suggestion.id !== suggestionId);
    setWorkspaceMeetings((prev) =>
      prev.map((item) => item.id === meetingId ? withMeetingSuggestions(item, suggestedTasks) : item)
    );
    saveMeetingSuggestions(meetingId, meeting.workspaceId, suggestedTasks);
  }, [workspaceMeetings, saveMeetingSuggestions]);

  const createTasksFromMeeting = useCallback(async (meetingId, selectedSuggestedTaskIds) => {
    if (!currentUser) return [];
    const meeting = workspaceMeetings.find((m) => m.id === meetingId);
    const meetingSuggestions = getMeetingSuggestions(meeting);
    if (!meeting || meetingSuggestions.length === 0) return [];

    const suggestions = selectedSuggestedTaskIds
      ? meetingSuggestions.filter((s) => selectedSuggestedTaskIds.includes(s.id))
      : meetingSuggestions.filter((s) => s.approved);

    if (suggestions.length === 0) {
      showToast('info', 'No tasks selected to create.');
      return [];
    }

    const invalidSuggestion = suggestions.find((suggestion) =>
      !suggestion.title?.trim() || (suggestion.startDate && suggestion.deadline && suggestion.startDate > suggestion.deadline)
    );
    if (invalidSuggestion) {
      showToast('error', 'Each selected task needs a title, and its start date cannot be after its deadline.');
      return [];
    }

    try {
      const { tasksApi } = await import('@/services/cloudClient');
      const newTasks = [];
      for (const suggestion of suggestions) {
        const created = await tasksApi.create({
          workspaceId: activeWorkspaceId,
          meetingId,
          title: suggestion.title.trim(),
          description: suggestion.description || '',
          assigneeId: suggestion.assigneeId || undefined,
          teamId: suggestion.teamId || undefined,
          priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(suggestion.priority) ? suggestion.priority : 'MEDIUM',
          startDate: suggestion.startDate || undefined,
          deadline: suggestion.deadline || undefined,
          createdBy: currentUser.id,
          generatedFromAI: true,
          aiConfidence: suggestion.confidence ?? suggestion.confidenceScore ?? undefined,
        });
        newTasks.push(normalizeTaskForUi(created));
      }

      if (newTasks && newTasks.length > 0) {
        setWorkspaceTasks((prev) => [...newTasks, ...prev]);
        publishExecutionChange(activeWorkspaceId, 'tasks');
        addActivity('tasks_created', newTasks.length + ' tasks created from meeting "' + (meeting.title || 'Meeting') + '"');

        const createdSuggestionIds = new Set(suggestions.map((suggestion) => suggestion.id));
        const remainingSuggestions = meetingSuggestions.filter((suggestion) => !createdSuggestionIds.has(suggestion.id));
        const generatedTaskIds = [...(meeting.generatedTaskIds || []), ...newTasks.map((task) => task.id)];

        setWorkspaceMeetings((prev) =>
          prev.map((item) => item.id === meetingId
            ? withMeetingSuggestions({
              ...item,
              status: remainingSuggestions.length ? 'AI_REVIEW_READY' : 'TASKS_GENERATED',
              generatedTaskIds,
            }, remainingSuggestions)
            : item)
        );
        saveMeetingSuggestions(meetingId, meeting.workspaceId, remainingSuggestions, {
          status: remainingSuggestions.length ? 'AI_REVIEW_READY' : 'TASKS_GENERATED',
          generatedTaskIds,
        });

        showToast('success', `${newTasks.length} task(s) created from meeting.`);
      }
      return newTasks;
    } catch (err) {
      showToast('error', 'Failed to create tasks: ' + (err.message || 'Unknown error'));
      return [];
    }
  }, [currentUser, workspaceMeetings, activeWorkspaceId, addActivity, showToast, saveMeetingSuggestions]);

  const createTasksFromSuggestions = createTasksFromMeeting;

  const getTasksByMeeting = useCallback((meetingId) => {
    return filterTasksByMeeting(workspaceTasks, meetingId);
  }, [workspaceTasks]);

  // â”€â”€â”€ Trash actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const restoreTrashItem = useCallback((type, id) => {
    const item = trashItems[type]?.find((i) => i.id === id);
    if (!item) return;

    if (type === 'tasks') {
      setWorkspaceTasks((prev) => [{ ...item, status: 'PENDING' }, ...prev]);
    } else if (type === 'meetings') {
      setWorkspaceMeetings((prev) => [item, ...prev]);
    }

    setTrashItems((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((i) => i.id !== id),
    }));
  }, [trashItems]);

  const permanentlyDeleteTrashItem = useCallback((type, id) => {
    setTrashItems((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((i) => i.id !== id),
    }));
  }, []);

  return {
    workspaceTasks,
    setWorkspaceTasks,
    workspaceMeetings,
    setWorkspaceMeetings,
    trashItems,
    setTrashItems,
    addWorkspaceTasks,
    moveWorkspaceTask,
    deleteWorkspaceTask,
    refreshWorkspaceExecutionData,
    createMeeting,
    deleteMeeting,
    uploadMeetingFile,
    processMeetingWithAI,
    analyzeMeetingWithAI,
    reAnalyzeMeeting,
    updateMeetingSuggestion,
    updateSuggestedTask,
    toggleSuggestedTaskSelection,
    removeMeetingSuggestion,
    createTasksFromMeeting,
    createTasksFromSuggestions,
    getTasksByMeeting,
    restoreTrashItem,
    permanentlyDeleteTrashItem,
  };
}

function getTaskTeamName(task, workspace) {
  const team = (workspace?.teams || []).find((item) => item.id === task.teamId);
  const workspaceName = workspace?.name || 'Workspace';
  return team?.name ? `${workspaceName} · ${team.name}` : workspaceName;
}

function publishExecutionChange(workspaceId, resource) {
  if (!workspaceId) return;
  getGlobalSocket()?.emit('workspace:event', {
    workspaceId,
    type: 'WORKSPACE_EXECUTION_CHANGED',
    payload: { resource },
  });
}
