/**
 * Meeting entity — workspace-scoped meeting with AI processing flow
 *
 * @typedef {Object} Meeting
 * @property {string} id
 * @property {string} workspaceId
 * @property {string} [teamId]
 * @property {string} title
 * @property {'TRANSCRIPT'|'AUDIO'} [type]
 * @property {'DRAFT'|'UPLOADED'|'PROCESSING'|'AI_REVIEW_READY'|'TASKS_GENERATED'|'COMPLETED'|'FAILED'} status
 * @property {string} [fileName]
 * @property {Object} [audioFile]
 * @property {string} [storageKey]
 * @property {string} [transcript]
 * @property {string} [transcriptText]
 * @property {string[]} [participantIds]
 * @property {string} [aiSummary]
 * @property {string} [summary]
 * @property {string[]} [keyDecisions]
 * @property {string[]} [actionItems]
 * @property {string[]} [risks]
 * @property {Array<SuggestedTask>} [suggestedTasks]
 * @property {string[]} [generatedTaskIds]
 * @property {string} [processingJobId]
 * @property {string} [processingError]
 * @property {string} [createdBy]
 * @property {string} createdAt
 * @property {string} [updatedAt]
 *
 * @typedef {Object} SuggestedTask
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} [assigneeId]
 * @property {string} [teamId]
 * @property {string} [priority]
 * @property {string} [deadline]
 * @property {number} [confidence]
 * @property {'PENDING_REVIEW'|'APPROVED'|'REJECTED'} [status]
 * @property {boolean} [approved]
 * @property {boolean} [selected]
 * @property {string} [sourceQuote]
 * @property {string[]} [missingFields]
 */

export const MEETING_STATUSES = {
  DRAFT: 'DRAFT',
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  AI_REVIEW_READY: 'AI_REVIEW_READY',
  TASKS_GENERATED: 'TASKS_GENERATED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

export const MEETING_TYPES = {
  TRANSCRIPT: 'TRANSCRIPT',
  AUDIO: 'AUDIO',
};

/**
 * Create a new Meeting object
 * @param {Object} data
 * @returns {Meeting}
 */
export function createMeeting(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    workspaceId: data.workspaceId,
    teamId: data.teamId || null,
    title: data.title || '',
    type: data.type || MEETING_TYPES.TRANSCRIPT,
    status: data.status || MEETING_STATUSES.UPLOADED,
    fileName: data.fileName || null,
    audioFile: data.audioFile || null,
    storageKey: data.storageKey || null,
    transcript: data.transcript || '',
    transcriptText: data.transcriptText || data.transcript || '',
    participantIds: data.participantIds || [],
    aiSummary: data.aiSummary || '',
    summary: data.summary || '',
    keyDecisions: data.keyDecisions || [],
    actionItems: data.actionItems || [],
    risks: data.risks || [],
    suggestedTasks: data.suggestedTasks || [],
    generatedTaskIds: data.generatedTaskIds || [],
    processingJobId: data.processingJobId || null,
    processingError: data.processingError || null,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}
