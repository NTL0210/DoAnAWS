/**
 * VoiceRepository interface (JSDoc contract)
 *
 * @interface VoiceRepository
 */

/**
 * Create a voice record
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function createVoiceRecord(data) { throw new Error('Not implemented'); }

/**
 * Update a voice record
 * @param {string} recordId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateVoiceRecord(recordId, updates) { throw new Error('Not implemented'); }

/**
 * Find voice records by channel
 * @param {string} workspaceId
 * @param {string} channelId
 * @returns {Promise<Object[]>}
 */
export async function findByChannel(workspaceId, channelId) { throw new Error('Not implemented'); }

/**
 * Delete a voice record
 * @param {string} recordId
 * @returns {Promise<boolean>}
 */
export async function deleteVoiceRecord(recordId) { throw new Error('Not implemented'); }

export default { createVoiceRecord, updateVoiceRecord, findByChannel, deleteVoiceRecord };
