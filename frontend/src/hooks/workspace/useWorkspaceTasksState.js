'use client';

import { useEffect, useState, useCallback } from 'react';
import { generateId } from '@/lib/workspaceData';
import { analyzeMeeting as serviceAnalyzeMeeting, createMeeting as serviceCreateMeeting, deleteMeeting as serviceDeleteMeeting, updateMeeting as serviceUpdateMeeting, uploadMeetingFile as serviceUploadMeetingFile } from '@/services/meetingService';
import { getTasksByMeeting as filterTasksByMeeting } from '@/services/taskService';
import { isCloudMode } from '@/services/apiClient';

const EMPTY_TRASH = { tasks: [], meetings: [], teams: [] };
const UI_TO_API_STATUS = {
  TODO: 'PENDING',
  REVIEW: 'IN_PROGRESS',
};
const API_TO_UI_STATUS = {
  PENDING: 'TODO',
};

function normalizeTaskForUi(task) {
  return {
    ...task,
    status: API_TO_UI_STATUS[task.status] || task.status || 'TODO',
    departmentId: task.departmentId || task.workspaceId,
  };
}

function normalizeMeetingForUi(meeting, activeWorkspaceId, currentUserId) {
  return {
    ...meeting,
    departmentId: meeting.departmentId || meeting.workspaceId || activeWorkspaceId,
    uploadedBy: meeting.uploadedBy || meeting.createdBy || currentUserId,
    suggestions: meeting.suggestions || meeting.suggestedTasks || [],
  };
}

function normalizeTaskStatusForApi(status) {
  return UI_TO_API_STATUS[status] || status;
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
  showToast,
  completeOnboardingStep,
}) {
  const [workspaceTasks, setWorkspaceTasks] = useState([]);
  const [workspaceMeetings, setWorkspaceMeetings] = useState([]);
  const [trashItems, setTrashItems] = useState(EMPTY_TRASH);

  useEffect(() => {
    if (!isCloudMode() || !activeWorkspaceId || !currentUser?.id) {
      setWorkspaceTasks([]);
      setWorkspaceMeetings([]);
      return;
    }

    let cancelled = false;

    async function loadWorkspaceExecutionData() {
      try {
        const { meetingsApi, tasksApi } = await import('@/services/cloudClient');
        const [meetingsResult, tasksResult] = await Promise.all([
          meetingsApi.list({ workspaceId: activeWorkspaceId, limit: 100 }),
          tasksApi.list({ workspaceId: activeWorkspaceId, limit: 100 }),
        ]);
        if (cancelled) return;

        const meetings = Array.isArray(meetingsResult)
          ? meetingsResult
          : meetingsResult?.items || [];
        const tasks = Array.isArray(tasksResult)
          ? tasksResult
          : tasksResult?.items || [];

        setWorkspaceMeetings(
          meetings.map((meeting) => normalizeMeetingForUi(meeting, activeWorkspaceId, currentUser.id))
        );
        setWorkspaceTasks(tasks.map(normalizeTaskForUi));
      } catch (err) {
        if (!cancelled) {
          showToast('error', err?.message || 'Failed to load workspace data.');
          setWorkspaceMeetings([]);
          setWorkspaceTasks([]);
        }
      }
    }

    loadWorkspaceExecutionData();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, currentUser?.id, showToast]);

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
          title: task.title,
          description: task.description || '',
          assigneeId: task.assigneeId || undefined,
          priority: ['LOW', 'MEDIUM', 'HIGH'].includes(task.priority) ? task.priority : 'MEDIUM',
          deadline: task.deadline || undefined,
          createdBy: currentUser?.id,
        });
        createdTasks.push(normalizeTaskForUi(created));
      }
      setWorkspaceTasks((prev) => [...createdTasks, ...prev]);
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
        status: normalizeTaskStatusForApi(newStatus),
        expectedVersion: current.version || 1,
      });
      setWorkspaceTasks((prev) =>
        prev.map((task) => (task.id === taskId ? normalizeTaskForUi(saved) : task))
      );
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
      const newMeeting = normalizeMeetingForUi(saved, activeWorkspaceId, currentUser.id);
      setWorkspaceMeetings((prev) => [newMeeting, ...prev]);
      addActivity('meeting_created', 'Meeting "' + newMeeting.title + '" uploaded');
      showToast('success', 'Meeting created successfully.');
      completeOnboardingStep('meetingUploaded');
      return newMeeting;
    } catch (err) {
      showToast('error', err.message || 'Failed to create meeting.');
      return null;
    }
  }, [activeWorkspace, currentUser, canManageAIReview, workspaceRole, activeWorkspaceId, addActivity, showToast, completeOnboardingStep]);

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
    } catch (err) {
      showToast('error', err.message || 'Upload failed');
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

      const suggestions = (result?.suggestedTasks || result?.tasks || []).map((task, idx) => ({
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
      }));

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

  const updateMeetingSuggestion = useCallback((meetingId, suggestionId, patch) => {
    setWorkspaceMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) return m;
        return {
          ...m,
          suggestions: (m.suggestions || []).map((s) =>
            s.id === suggestionId ? { ...s, ...patch } : s
          ),
        };
      })
    );
  }, []);

  const updateSuggestedTask = updateMeetingSuggestion;

  const toggleSuggestedTaskSelection = useCallback((meetingId, suggestionId) => {
    setWorkspaceMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) return m;
        return {
          ...m,
          suggestions: (m.suggestions || []).map((s) =>
            s.id === suggestionId ? { ...s, approved: !s.approved } : s
          ),
        };
      })
    );
  }, []);

  const removeMeetingSuggestion = useCallback((meetingId, suggestionId) => {
    setWorkspaceMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) return m;
        return {
          ...m,
          suggestions: (m.suggestions || []).filter((s) => s.id !== suggestionId),
        };
      })
    );
  }, []);

  const createTasksFromMeeting = useCallback(async (meetingId, selectedSuggestedTaskIds) => {
    if (!currentUser) return [];
    const meeting = workspaceMeetings.find((m) => m.id === meetingId);
    const meetingSuggestions = meeting?.suggestions || meeting?.suggestedTasks || [];
    if (!meeting || meetingSuggestions.length === 0) return [];

    const suggestions = selectedSuggestedTaskIds
      ? meetingSuggestions.filter((s) => selectedSuggestedTaskIds.includes(s.id))
      : meetingSuggestions.filter((s) => s.approved);

    if (suggestions.length === 0) {
      showToast('info', 'No tasks selected to create.');
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
          priority: ['LOW', 'MEDIUM', 'HIGH'].includes(suggestion.priority) ? suggestion.priority : 'MEDIUM',
          deadline: suggestion.deadline || undefined,
          createdBy: currentUser.id,
        });
        newTasks.push(normalizeTaskForUi(created));
      }

      if (newTasks && newTasks.length > 0) {
        setWorkspaceTasks((prev) => [...newTasks, ...prev]);
        addActivity('tasks_created', newTasks.length + ' tasks created from meeting "' + (meeting.title || 'Meeting') + '"');

        // Auto-post to team chat
        setWorkspaceMeetings((prev) =>
          prev.map((m) => (m.id === meetingId ? { ...m, suggestions: [] } : m))
        );

        showToast('success', `${newTasks.length} task(s) created from meeting.`);
      }
      return newTasks;
    } catch (err) {
      showToast('error', 'Failed to create tasks: ' + (err.message || 'Unknown error'));
      return [];
    }
  }, [currentUser, workspaceMeetings, activeWorkspaceId, addActivity, showToast]);

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
