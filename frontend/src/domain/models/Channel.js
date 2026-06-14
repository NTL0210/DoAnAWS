/**
 * Channel entity
 *
 * @typedef {Object} Channel
 * @property {string} id
 * @property {string} name
 * @property {'text'|'voice'} type
 * @property {string} [description]
 * @property {boolean} [isDefault]
 * @property {'WORKSPACE'|'TEAM'|'CUSTOM'} [scope]
 * @property {string} [teamId]
 * @property {string[]} [allowedTeamIds]
 * @property {string[]} [allowedUserIds]
 * @property {string[]} [deniedUserIds]
 * @property {boolean} [isLocked]
 * @property {boolean} [allowRecording]
 * @property {string} [createdBy]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const CHANNEL_TYPES = {
  TEXT: 'text',
  VOICE: 'voice',
};

export const CHANNEL_SCOPES = {
  WORKSPACE: 'WORKSPACE',
  TEAM: 'TEAM',
  CUSTOM: 'CUSTOM',
};

/**
 * Create a new Channel object
 * @param {Object} data
 * @returns {Channel}
 */
export function createChannel(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    name: data.name || '',
    type: data.type || CHANNEL_TYPES.TEXT,
    description: data.description || '',
    isDefault: Boolean(data.isDefault),
    scope: data.scope || CHANNEL_SCOPES.WORKSPACE,
    teamId: data.teamId || null,
    allowedTeamIds: data.allowedTeamIds || [],
    allowedUserIds: data.allowedUserIds || [],
    deniedUserIds: data.deniedUserIds || [],
    isLocked: Boolean(data.isLocked),
    allowRecording: data.allowRecording !== false,
    createdBy: data.createdBy || null,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}
