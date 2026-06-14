import { generateId } from '@/services/workspaceService';

export function createTask(data) {
  const now = new Date().toISOString();
  return {
    id: data.id || 'task-' + generateId(),
    workspaceId: data.workspaceId || data.departmentId || null,
    departmentId: data.departmentId || data.workspaceId || null,
    teamId: data.teamId || null,
    title: data.title,
    description: data.description || '',
    assigneeId: data.assigneeId || null,
    status: data.status || 'TODO',
    assignmentStatus: data.assigneeId ? 'ASSIGNED' : 'NEED_ASSIGNMENT',
    priority: data.priority || 'MEDIUM',
    deadline: data.deadline || null,
    sourceMeetingId: data.sourceMeetingId || null,
    meetingId: data.meetingId || data.sourceMeetingId || null,
    generatedFromAI: Boolean(data.generatedFromAI),
    aiConfidence: data.aiConfidence ?? null,
    confidenceScore: data.confidenceScore ?? data.aiConfidence ?? null,
    sourceMeetingTitle: data.sourceMeetingTitle || null,
    sourceQuote: data.sourceQuote || data.transcriptExcerpt || null,
    transcriptExcerpt: data.transcriptExcerpt || data.sourceQuote || null,
    sourceTimestamp: data.sourceTimestamp || null,
    reason: data.reason || null,
    sourceEvidence: data.sourceEvidence || [],
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || null,
    progress: data.progress || 0,
  };
}

export function createTasksFromSuggestions(meetingId, suggestions, metadata = {}) {
  return (suggestions || [])
    .filter((suggestion) => suggestion.title?.trim())
    .map((suggestion) =>
      createTask({
        workspaceId: metadata.workspaceId,
        departmentId: metadata.workspaceId,
        teamId: suggestion.teamId || metadata.teamId || null,
        title: suggestion.title.trim(),
        description: suggestion.description || '',
        assigneeId: suggestion.assigneeId || null,
        priority: suggestion.priority || 'MEDIUM',
        deadline: suggestion.deadline || null,
        sourceMeetingId: meetingId,
        meetingId,
        generatedFromAI: true,
        aiConfidence: suggestion.confidence,
        confidenceScore: suggestion.confidenceScore ?? suggestion.confidence,
        sourceMeetingTitle: suggestion.sourceMeetingTitle || metadata.meetingTitle || null,
        sourceQuote: suggestion.sourceQuote || suggestion.transcriptExcerpt || null,
        transcriptExcerpt: suggestion.transcriptExcerpt || suggestion.sourceQuote || null,
        sourceTimestamp: suggestion.sourceTimestamp || null,
        reason: suggestion.reason || null,
        sourceEvidence: suggestion.sourceEvidence || [],
        createdBy: metadata.createdBy || null,
      })
    );
}

export function updateTask(task, updates) {
  return { ...task, ...updates, updatedAt: new Date().toISOString() };
}

export function getTasksByWorkspace(tasks, workspaceId) {
  return (tasks || []).filter((task) =>
    !task.deletedAt && (task.workspaceId === workspaceId || task.departmentId === workspaceId || !task.departmentId)
  );
}

export function getTasksByMeeting(tasks, meetingId) {
  return (tasks || []).filter((task) =>
    !task.deletedAt && (task.sourceMeetingId === meetingId || task.meetingId === meetingId)
  );
}
