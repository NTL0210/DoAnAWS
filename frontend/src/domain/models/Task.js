/**
 * Task entity
 *
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} workspaceId
 * @property {string} [teamId]
 * @property {string} [meetingId]
 * @property {string} [sourceMeetingId]
 * @property {string} title
 * @property {string} [description]
 * @property {string} [assigneeId]
 * @property {'TODO'|'IN_PROGRESS'|'REVIEW'|'COMPLETED'|'CANCELLED'|'OVERDUE'} status
 * @property {'LOW'|'MEDIUM'|'HIGH'|'URGENT'} [priority]
 * @property {string} [deadline]
 * @property {number} [progress]
 * @property {boolean} [generatedFromAI]
 * @property {number} [aiConfidence]
 * @property {string} [createdBy]
 * @property {string} createdAt
 * @property {string} [updatedAt]
 */

export const TASK_STATUSES = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  OVERDUE: 'OVERDUE',
};

export const TASK_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

/**
 * Create a new Task object
 * @param {Object} data
 * @returns {Task}
 */
export function createTask(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    workspaceId: data.workspaceId || null,
    teamId: data.teamId || null,
    meetingId: data.meetingId || data.sourceMeetingId || null,
    sourceMeetingId: data.sourceMeetingId || data.meetingId || null,
    title: data.title || '',
    description: data.description || '',
    assigneeId: data.assigneeId || null,
    status: data.status || TASK_STATUSES.TODO,
    priority: data.priority || TASK_PRIORITIES.MEDIUM,
    deadline: data.deadline || null,
    progress: data.progress || 0,
    generatedFromAI: Boolean(data.generatedFromAI),
    aiConfidence: data.aiConfidence ?? null,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || null,
  };
}

/**
 * Validate task data
 * @param {Object} data
 * @returns {string[]} Array of validation errors
 */
export function validateTask(data) {
  const errors = [];
  if (!data.title || !data.title.trim()) errors.push('Title is required');
  if (!data.workspaceId) errors.push('workspaceId is required');
  if (data.priority && !Object.values(TASK_PRIORITIES).includes(data.priority)) {
    errors.push(`Invalid priority: ${data.priority}`);
  }
  return errors;
}
