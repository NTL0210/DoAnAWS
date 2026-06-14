/**
 * VoiceService — business logic for voice recordings
 */

import { voiceRepo } from '@/repositories';
import { sanitizeVoiceFileName, MAX_VOICE_RECORDING_SIZE_BYTES } from '@/lib/voicePermissions';

/**
 * Create a voice recording record
 * @param {Object} recordData
 * @returns {Promise<Object>}
 */
export async function createVoiceRecord(recordData) {
  return voiceRepo.createVoiceRecord({
    ...recordData,
    fileName: sanitizeVoiceFileName(recordData.fileName || 'voice-recording.webm'),
  });
}

/**
 * Upload a voice record blob
 * @param {string} recordId
 * @param {Blob} blob
 * @returns {Promise<Object|null>}
 */
export async function uploadVoiceRecord(recordId, blob) {
  return voiceRepo.updateVoiceRecord(recordId, {
    sizeBytes: blob?.size || 0,
  });
}

/**
 * Get voice records for a channel
 * @param {string} workspaceId
 * @param {string} channelId
 * @returns {Promise<Object[]>}
 */
export async function getVoiceRecordsByChannel(workspaceId, channelId) {
  return voiceRepo.findByChannel(workspaceId, channelId);
}

/**
 * Delete a voice record
 * @param {string} recordId
 * @returns {Promise<boolean>}
 */
export async function deleteVoiceRecord(recordId) {
  return voiceRepo.deleteVoiceRecord(recordId);
}

/**
 * Mark a voice record as sent to AI
 * @param {string} recordId
 * @returns {Promise<Object|null>}
 */
export async function sendVoiceRecordToAI(recordId) {
  return voiceRepo.updateVoiceRecord(recordId, { aiStatus: 'SENT_TO_AI' });
}
