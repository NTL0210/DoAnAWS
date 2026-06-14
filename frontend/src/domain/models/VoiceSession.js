/**
 * VoiceSession entity — tracks who is in a voice channel
 *
 * @typedef {Object} VoiceParticipant
 * @property {string} userId
 * @property {string} name
 * @property {string} joinedAt
 * @property {'JOINED'|'LEFT'} [status]
 * @property {boolean} [isMuted]
 * @property {boolean} [isSpeaking]
 * @property {number} [audioLevel]
 * @property {boolean} [isRecording]
 * @property {string} [role]
 */

/**
 * ActiveVoiceRecording entity
 *
 * @typedef {Object} ActiveVoiceRecording
 * @property {string} id
 * @property {string} channelId
 * @property {string} workspaceId
 * @property {string} [teamId]
 * @property {string} startedBy
 * @property {string} startedAt
 * @property {number} [durationSeconds]
 * @property {number} [estimatedSizeBytes]
 * @property {string[]} [participantIds]
 * @property {'RECORDING'|'PAUSED'|'STOPPED'} [status]
 * @property {string} [mimeType]
 */

/**
 * VoiceRecord entity — a saved recording
 *
 * @typedef {Object} VoiceRecord
 * @property {string} id
 * @property {string} workspaceId
 * @property {string} channelId
 * @property {string} [teamId]
 * @property {string} title
 * @property {string} recordedBy
 * @property {string[]} [participantIds]
 * @property {number} [durationSeconds]
 * @property {number} [sizeBytes]
 * @property {string} [format]
 * @property {string} [fileName]
 * @property {string} [objectUrl]
 * @property {string} [storageKey]
 * @property {string} [downloadUrl]
 * @property {'RECORDING'|'READY'|'DELETED'} [status]
 * @property {'NOT_SENT'|'SENT_TO_AI'|'FAILED'} [aiStatus]
 * @property {string} [sourceMeetingId]
 * @property {boolean} [autoStopped]
 * @property {string} [description]
 * @property {string} createdAt
 * @property {string} [updatedAt]
 */

/**
 * Create a VoiceParticipant object
 * @param {Object} data
 * @returns {VoiceParticipant}
 */
export function createVoiceParticipant(data) {
  return {
    userId: data.userId,
    name: data.name || '',
    joinedAt: data.joinedAt || new Date().toISOString(),
    status: data.status || 'JOINED',
    isMuted: Boolean(data.isMuted),
    isSpeaking: Boolean(data.isSpeaking),
    audioLevel: data.audioLevel || 0,
    isRecording: Boolean(data.isRecording),
    role: data.role || 'EMPLOYEE',
  };
}
