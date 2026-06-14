/**
 * ChannelService — business logic for channels
 */

import { channelRepo } from '@/repositories';
import { normalizeVoiceChannel } from '@/lib/voicePermissions';
import { generateId } from '@/services/workspaceService';

/**
 * Get channels for a workspace
 * @param {string} workspaceId
 * @returns {Promise<Object[]>}
 */
export async function getChannelsByWorkspace(workspaceId) {
  return channelRepo.findByWorkspace(workspaceId);
}

/**
 * Create a new channel
 * @param {string} workspaceId
 * @param {Object} data
 * @param {string} data.name
 * @param {'text'|'voice'} data.type
 * @param {string} [data.description]
 * @param {string} [currentUserId]
 * @returns {Promise<Object|null>}
 */
export async function createChannel(workspaceId, data, currentUserId) {
  const channelId = 'ch-' + generateId();
  const newChannel = {
    id: channelId,
    name: data.name.toLowerCase().replace(/\s+/g, '-'),
    type: data.type || 'text',
    description: data.description || '',
    createdBy: currentUserId || null,
  };

  if (data.type === 'voice') {
    Object.assign(newChannel, normalizeVoiceChannel({
      ...newChannel,
      name: data.name.trim() || 'New Voice',
      scope: 'WORKSPACE',
    }));
  }

  return channelRepo.create(workspaceId, newChannel);
}

/**
 * Delete a channel
 * @param {string} workspaceId
 * @param {string} channelId
 * @returns {Promise<void>}
 */
export async function deleteChannel(workspaceId, channelId) {
  return channelRepo.delete_(workspaceId, channelId);
}
