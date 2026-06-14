/**
 * MessageService — business logic for messages
 */

import { messageRepo } from '@/repositories';
import { generateId } from '@/services/workspaceService';

/**
 * Get messages for a channel
 * @param {string} channelId
 * @returns {Promise<Object[]>}
 */
export async function getMessagesByChannel(channelId) {
  return messageRepo.findByChannel(channelId);
}

/**
 * Get messages for a team chat
 * @param {string} teamChatKey
 * @returns {Promise<Object[]>}
 */
export async function getMessagesByTeamChat(teamChatKey) {
  return messageRepo.findByTeamChat(teamChatKey);
}

/**
 * Send a message to a channel
 * @param {Object} params
 * @param {string} params.channelId
 * @param {string} params.workspaceId
 * @param {string} params.userId
 * @param {string} params.content
 * @param {Array} [params.attachments]
 * @returns {Promise<Object>}
 */
export async function sendMessage({ channelId, workspaceId, userId, content, attachments }) {
  if (!content?.trim()) return null;
  return messageRepo.create({
    id: 'msg-' + generateId(),
    channelId,
    workspaceId,
    userId,
    content: content.trim(),
    attachments: attachments || [],
  });
}

/**
 * Send a message to a team chat
 * @param {Object} params
 * @param {string} params.teamId
 * @param {string} params.workspaceId
 * @param {string} params.userId
 * @param {string} params.content
 * @param {Array} [params.attachments]
 * @returns {Promise<Object>}
 */
export async function sendTeamMessage({ teamId, workspaceId, userId, content, attachments }) {
  if (!teamId || !content?.trim()) return null;
  return messageRepo.create({
    id: 'msg-' + generateId(),
    teamId,
    workspaceId,
    userId,
    content: content.trim(),
    attachments: attachments || [],
    scope: 'TEAM',
  });
}
