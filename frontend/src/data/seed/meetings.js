/**
 * Seed data: AI workspace meetings
 * Extracted from src/lib/workspaceData.js
 */

/**
 * Mock AI workspace meetings
 * @type {Array<Object>}
 */
export const mockWorkspaceMeetings = [
  {
    id: 'meeting-ai-1',
    workspaceId: 'ws-1',
    teamId: 'team-3',
    title: 'AI Meeting Review Flow Kickoff',
    type: 'TRANSCRIPT',
    status: 'AI_REVIEW_READY',
    participants: ['user-1', 'user-3'],
    participantIds: ['user-1', 'user-3'],
    transcript: 'Alex: We need a review step before creating AI tasks. John: I can polish the suggested task card and confidence warnings by Friday.',
    transcriptText: 'Alex: We need a review step before creating AI tasks. John: I can polish the suggested task card and confidence warnings by Friday.',
    audioFile: null,
    storageKey: null,
    aiSummary: 'The team aligned on a manager review flow where AI suggests tasks, managers edit and approve, then tasks are created with meeting traceability.',
    summary: 'The team aligned on a manager review flow where AI suggests tasks, managers edit and approve, then tasks are created with meeting traceability.',
    keyDecisions: [
      'AI must not create tasks without manager approval.',
      'Every created task should keep sourceMeetingId.',
    ],
    risks: [
      'Low confidence suggestions need clear review warnings.',
    ],
    actionItems: [
      'Build suggested task cards with edit controls.',
      'Show generated tasks in meeting detail.',
    ],
    suggestedTasks: [
      {
        id: 'suggestion-ai-1',
        title: 'Build suggested task review cards',
        description: 'Create editable cards for AI suggested tasks with selection, assignee, team, priority, deadline, and confidence.',
        assigneeId: 'user-3',
        teamId: 'team-3',
        priority: 'HIGH',
        deadline: '2026-06-12',
        confidence: 0.88,
        status: 'PENDING_REVIEW',
        approved: true,
        selected: true,
        sourceQuote: 'John: I can polish the suggested task card and confidence warnings by Friday.',
        missingFields: [],
      },
      {
        id: 'suggestion-ai-2',
        title: 'Add low confidence review warning',
        description: 'Display Needs review for confidence lower than 80 percent.',
        assigneeId: null,
        teamId: 'team-3',
        priority: 'MEDIUM',
        deadline: null,
        confidence: 0.72,
        status: 'PENDING_REVIEW',
        approved: false,
        selected: false,
        sourceQuote: 'John: confidence warnings by Friday.',
        missingFields: ['assigneeId', 'deadline'],
      },
    ],
    generatedTaskIds: [],
    processingJobId: 'mock-job-seed-1',
    processingError: null,
    createdBy: 'user-1',
    createdAt: '2026-06-06T09:00:00Z',
    updatedAt: '2026-06-06T09:05:00Z',
  },
];

export default mockWorkspaceMeetings;
