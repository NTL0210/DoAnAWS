import { generateId } from '@/services/workspaceService';

export async function createMeeting(data) {
  return {
    ...data,
    id: data.id || 'meeting-' + generateId(),
    status: data.status || 'UPLOADED',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function uploadMeetingFile(file, metadata = {}) {
  if (!file) return null;
  const safeName = sanitizeFileName(file.name);
  return {
    storageKey: `mock/meetings/${metadata.workspaceId || 'workspace'}/${Date.now()}-${safeName}`,
    fileName: safeName,
    fileType: file.type || metadata.type || 'application/octet-stream',
    fileSize: file.size || 0,
    url: null,
  };
}

export async function analyzeMeeting(meeting, context = {}) {
  await new Promise((resolve) => setTimeout(resolve, 900));
  const teamMembers = context.team?.memberIds?.length
    ? (context.members || []).filter((member) => context.team.memberIds.includes(member.userId))
    : (context.members || []);
  const primary = teamMembers[0] || context.members?.[0] || null;
  const secondary = teamMembers[1] || teamMembers[0] || context.members?.[1] || null;

  return {
    processingJobId: 'mock-job-' + generateId(),
    aiSummary: `${meeting.title} was analyzed by mock AI. The discussion produced clear execution items, review needs, and follow-up tasks for ${context.team?.name || 'the workspace'}.`,
    summary: `${meeting.title} was analyzed by mock AI. The discussion produced clear execution items, review needs, and follow-up tasks for ${context.team?.name || 'the workspace'}.`,
    keyDecisions: [
      'AI suggestions require manager review before task creation.',
      'Created tasks must retain meeting traceability.',
      'Team-scoped meetings should create team-scoped task suggestions.',
    ],
    risks: [
      'Low-confidence suggestions require manager validation.',
      'Missing assignee or deadline should be confirmed before execution.',
    ],
    actionItems: [
      'Review suggested tasks.',
      'Confirm missing assignees and deadlines.',
      'Create selected tasks for the team.',
    ],
    suggestedTasks: [
      buildSuggestion(meeting, primary, 'Review AI suggested tasks', 'Validate task title, owner, deadline, and priority before creation.', 'HIGH', 0.91, 3, '00:03:20'),
      buildSuggestion(meeting, secondary, 'Prepare implementation follow-up', 'Coordinate the next implementation step from the meeting discussion.', 'MEDIUM', 0.84, 5, '00:08:45'),
      buildSuggestion(meeting, null, 'Validate analytics impact', 'Check whether generated tasks update dashboard and workload analytics correctly.', 'MEDIUM', 0.72, null, '00:12:10'),
    ],
  };
}

export async function getMeetingById() {
  return null;
}

export async function getMeetingsByWorkspace() {
  return [];
}

export async function updateMeeting(meeting, updates) {
  return { ...meeting, ...updates, updatedAt: new Date().toISOString() };
}

function buildSuggestion(meeting, assignee, title, description, priority, confidence, daysFromNow, sourceTimestamp) {
  const quote = `Discussion point: ${description}`;
  return {
    id: 'suggestion-' + generateId(),
    title,
    description,
    assigneeId: assignee?.userId || null,
    teamId: meeting.teamId || null,
    priority,
    deadline: daysFromNow ? nextDate(daysFromNow) : null,
    confidence,
    confidenceScore: confidence,
    status: 'PENDING_REVIEW',
    selected: Boolean(assignee && daysFromNow),
    approved: Boolean(assignee && daysFromNow),
    sourceMeetingId: meeting.id,
    sourceMeetingTitle: meeting.title,
    sourceQuote: quote,
    transcriptExcerpt: quote,
    sourceTimestamp,
    reason: 'Mock AI found an action-oriented statement with an owner, deadline, or follow-up intent.',
    missingFields: [
      !assignee ? 'assigneeId' : null,
      !daysFromNow ? 'deadline' : null,
    ].filter(Boolean),
  };
}

function nextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sanitizeFileName(name = 'meeting-file') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}
