'use client';

import { useState, useCallback, useRef } from 'react';
import { generateId } from '@/lib/workspaceData';
import { analyzeMeeting as serviceAnalyzeMeeting, uploadMeetingFile as serviceUploadMeetingFile } from '@/services/meetingService';
import { createTasksFromSuggestions as buildTasksFromSuggestions, getTasksByMeeting as serviceGetTasksByMeeting } from '@/services/taskService';

const EMPTY_TRASH = { tasks: [], meetings: [], teams: [] };

/**
 * useWorkspaceTasksState — manages workspace tasks, meetings, trash, and AI workflow actions.
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
 *   uploadMeetingMock: (meetingId: string, file: Object) => Promise<void>,
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

  // ─── Task Actions ──────────────────────────────────────
  const addWorkspaceTasks = useCallback((newTasks) => {
    if (!Array.isArray(newTasks)) return;
    const tagged = newTasks.map((task) => ({
      ...task,
      id: task.id || 'task-' + generateId(),
      workspaceId: task.workspaceId || activeWorkspaceId,
      createdAt: task.createdAt || new Date().toISOString(),
    }));
    setWorkspaceTasks((prev) => [...tagged, ...prev]);
  }, [activeWorkspaceId]);

  const moveWorkspaceTask = useCallback((taskId, newStatus) => {
    setWorkspaceTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, status: newStatus, updatedAt: new Date().toISOString() };
      })
    );
  }, []);

  // ─── Meeting Actions ───────────────────────────────────
  const createMeeting = useCallback((meetingData) => {
    const allowed = canManageAIReview || workspaceRole === 'OWNER';
    if (!activeWorkspace || !currentUser || !allowed) {
      showToast('error', 'You do not have permission to create meetings.');
      return null;
    }

    const newMeeting = {
      id: 'mtg-' + generateId(),
      title: meetingData.title || 'Untitled Meeting',
      departmentId: activeWorkspaceId,
      uploadedBy: currentUser.id,
      transcriptText: meetingData.transcriptText || meetingData.transcript || '',
      audioUrl: meetingData.audioUrl || null,
      summary: null,
      status: 'UPLOADED',
      suggestions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkspaceMeetings((prev) => [newMeeting, ...prev]);
    addActivity('meeting_created', 'Meeting "' + newMeeting.title + '" uploaded');
    showToast('success', 'Meeting created successfully.');
    completeOnboardingStep('meetingUploaded');
    return newMeeting;
  }, [activeWorkspace, currentUser, canManageAIReview, workspaceRole, activeWorkspaceId, addActivity, showToast, completeOnboardingStep]);

  const uploadMeetingMock = useCallback(async (meetingId, file) => {
    const meeting = workspaceMeetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    try {
      const result = await serviceUploadMeetingFile(meetingId, file);
      setWorkspaceMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, ...result } : m))
      );
    } catch (err) {
      showToast('error', err.message || 'Upload failed');
    }
  }, [workspaceMeetings, showToast]);

  const processMeetingWithAI = useCallback(async (meetingOrId) => {
    const meetingId = typeof meetingOrId === 'string' ? meetingOrId : meetingOrId?.id;
    const meeting = workspaceMeetings.find((m) => m.id === meetingId);
    if (!meeting) return;

    setWorkspaceMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, status: 'PROCESSING' } : m))
    );

    try {
      const transcript = meeting.transcriptText || meeting.transcript || '';
      const result = await serviceAnalyzeMeeting(transcript, {
        members: workspaceMembers,
        currentUserId: currentUser?.id,
      });

      const suggestions = (result?.tasks || []).map((task, idx) => ({
        id: 'sug-' + generateId(),
        meetingId,
        title: task.title || 'Untitled Task',
        description: task.description || '',
        assignee: task.assignee || null,
        assigneeId: task.assigneeId || null,
        deadline: task.deadline || null,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(task.priority) ? task.priority : 'MEDIUM',
        confidence: typeof task.confidence === 'number' ? task.confidence : 0.5,
        approved: false,
        order: idx,
      }));

      setWorkspaceMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                status: 'COMPLETED',
                summary: result.summary || m.summary,
                suggestions,
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
  }, [workspaceMeetings, workspaceMembers, currentUser, addActivity, showToast]);

  const analyzeMeetingWithAI = processMeetingWithAI;

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
    if (!currentUser) return;
    const meeting = workspaceMeetings.find((m) => m.id === meetingId);
    if (!meeting || !meeting.suggestions) return;

    const suggestions = selectedSuggestedTaskIds
      ? meeting.suggestions.filter((s) => selectedSuggestedTaskIds.includes(s.id))
      : meeting.suggestions.filter((s) => s.approved);

    if (suggestions.length === 0) {
      showToast('info', 'No tasks selected to create.');
      return;
    }

    try {
      const newTasks = await buildTasksFromSuggestions(suggestions, {
        meetingId,
        workspaceId: activeWorkspaceId,
        createdBy: currentUser.id,
      });

      if (newTasks && newTasks.length > 0) {
        setWorkspaceTasks((prev) => [...newTasks, ...prev]);
        addActivity('tasks_created', newTasks.length + ' tasks created from meeting "' + (meeting.title || 'Meeting') + '"');

        // Auto-post to team chat
        const taskList = newTasks.map((t) => `- ${t.title} (${t.priority || 'MEDIUM'})`).join('\n');
        const systemMsg = {
          id: 'msg-' + generateId(),
          type: 'system',
          content: `**Tasks created from meeting "${meeting.title}"**\n${taskList}`,
          createdAt: new Date().toISOString(),
          scope: 'TEAM',
        };

        setWorkspaceMeetings((prev) =>
          prev.map((m) => (m.id === meetingId ? { ...m, suggestions: [] } : m))
        );

        showToast('success', `${newTasks.length} task(s) created from meeting.`);
      }
    } catch (err) {
      showToast('error', 'Failed to create tasks: ' + (err.message || 'Unknown error'));
    }
  }, [currentUser, workspaceMeetings, activeWorkspaceId, addActivity, showToast]);

  const createTasksFromSuggestions = createTasksFromMeeting;

  const getTasksByMeeting = useCallback((meetingId) => {
    return serviceGetTasksByMeeting(meetingId);
  }, []);

  // ─── Trash actions ─────────────────────────────────────
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
    createMeeting,
    uploadMeetingMock,
    processMeetingWithAI,
    analyzeMeetingWithAI,
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
