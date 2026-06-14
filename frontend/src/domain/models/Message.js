/**
 * Message entity
 *
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} channelId
 * @property {string} workspaceId
 * @property {string} userId
 * @property {string} content
 * @property {Array<Attachment>} [attachments]
 * @property {string} [teamId]
 * @property {'TEAM'} [scope]
 * @property {boolean} [system]
 * @property {string} createdAt
 * @property {string|null} [updatedAt]
 *
 * @typedef {Object} Attachment
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} [size]
 */

/**
 * Create a new Message object
 * @param {Object} data
 * @returns {Message}
 */
export function createMessage(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    channelId: data.channelId,
    workspaceId: data.workspaceId,
    userId: data.userId,
    content: data.content || '',
    attachments: data.attachments || [],
    teamId: data.teamId || null,
    scope: data.scope || null,
    system: Boolean(data.system),
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || null,
  };
}
