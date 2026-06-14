/**
 * Notification entity
 *
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} userId
 * @property {string} title
 * @property {string} [message]
 * @property {'AI_PROCESSED'|'TASK_ASSIGNED'|'TASK_OVERDUE'|'TASK_DEADLINE_SOON'|'TEAM_MESSAGE'|'MEETING_PROCESSED'|'AI_TASKS_APPROVED'} [type]
 * @property {boolean} [isRead]
 * @property {string} [workspaceId]
 * @property {string} [meetingId]
 * @property {string} [taskId]
 * @property {string} [teamId]
 * @property {string} createdAt
 */

/**
 * Create a new Notification object
 * @param {Object} data
 * @returns {Notification}
 */
export function createNotification(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    userId: data.userId || null,
    title: data.title || '',
    message: data.message || '',
    type: data.type || 'TASK_ASSIGNED',
    isRead: Boolean(data.isRead),
    workspaceId: data.workspaceId || null,
    meetingId: data.meetingId || null,
    taskId: data.taskId || null,
    teamId: data.teamId || null,
    createdAt: data.createdAt || now,
  };
}
