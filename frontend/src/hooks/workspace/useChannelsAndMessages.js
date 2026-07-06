'use client';

import { useState, useCallback, useMemo } from 'react';
import { generateId } from '@/lib/workspaceData';
import { normalizeVoiceChannel } from '@/lib/voicePermissions';
import { workspacesApi } from '@/services/cloudClient';

/**
 * useChannelsAndMessages — manages messages and channel CRUD.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @param {Object|null} params.activeWorkspace
 * @param {string|null} params.activeWorkspaceId
 * @param {string|null} params.activeChannelId
 * @param {string|null} params.activeTeamId
 * @param {Function} params.setWorkspaces
 * @param {Function} params.addActivity
 * @param {Function} params.addNotification
 * @returns {{
 *   messages: Object,
 *   setMessages: Function,
 *   channelMessages: Array,
 *   activeTeamMessages: Array,
 *   teamMessagesKey: string|null,
 *   createChannel: (name: string, type: string, description: string) => Object|null,
 *   deleteChannel: (channelId: string) => void,
 *   sendMessage: (channelId: string, content: string, attachments?: Array) => void,
 *   sendTeamMessage: (teamId: string, content: string, attachments?: Array) => void,
 * }}
 */
export default function useChannelsAndMessages({
  currentUser,
  activeWorkspace,
  activeWorkspaceId,
  activeChannelId,
  activeTeamId,
  setWorkspaces,
  addActivity,
  addNotification,
}) {
  const [messages, setMessages] = useState({});

  // ─── Derived ───────────────────────────────────────────
  const channelMessages = useMemo(() => {
    if (!activeChannelId) return [];
    return messages[activeChannelId] || [];
  }, [messages, activeChannelId]);

  const teamMessagesKey = activeTeamId ? 'team-chat-' + activeTeamId : null;

  const activeTeamMessages = useMemo(() => {
    if (!teamMessagesKey) return [];
    return messages[teamMessagesKey] || [];
  }, [messages, teamMessagesKey]);

  // ─── Channel Actions ───────────────────────────────────
  const createChannel = useCallback(async (name, type, description) => {
    if (!activeWorkspace || !currentUser) return null;

    const channelId = 'ch-' + generateId();
    const newChannel = {
      id: channelId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      type,
      description: description || '',
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    if (type === 'voice') {
      Object.assign(newChannel, normalizeVoiceChannel({
        ...newChannel,
        name: name.trim() || 'New Voice',
        scope: 'WORKSPACE',
      }));
    }

    const nextChannels = [...(activeWorkspace.channels || []), newChannel];
    try {
      const saved = await workspacesApi.update(activeWorkspace.id, {
        channels: nextChannels,
        expectedVersion: activeWorkspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      setMessages((prev) => ({ ...prev, [channelId]: [] }));
      addActivity('channel_created', 'Channel #' + newChannel.name + ' created');
      return newChannel;
    } catch {
      return null;
    }
  }, [activeWorkspace, currentUser, setWorkspaces, addActivity]);

  const deleteChannel = useCallback(async (channelId) => {
    if (!activeWorkspace) return;
    const nextChannels = (activeWorkspace.channels || []).filter((c) => c.id !== channelId);
    try {
      const saved = await workspacesApi.update(activeWorkspace.id, {
        channels: nextChannels,
        expectedVersion: activeWorkspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
    } catch {
      // Keep existing state if DynamoDB rejects the update.
    }
  }, [activeWorkspace, setWorkspaces]);

  // ─── Message Actions ───────────────────────────────────
  const sendMessage = useCallback(async (channelId, content, attachments) => {
    if (!currentUser || !content?.trim()) return;
    const channel = activeWorkspace?.channels?.find((item) => item.id === channelId);

    const newMsg = {
      id: 'msg-' + generateId(),
      channelId,
      workspaceId: activeWorkspaceId,
      userId: currentUser.id,
      content: content.trim(),
      attachments: attachments || [],
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    const nextMessages = {
      ...(messages || {}),
      [channelId]: [...(messages[channelId] || []), newMsg],
    };
    setMessages(nextMessages);
    if (activeWorkspace) {
      try {
        const saved = await workspacesApi.update(activeWorkspace.id, {
          messages: nextMessages,
          expectedVersion: activeWorkspace.version || 1,
        });
        setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      } catch {
        // Message remains visible locally until the next cloud refresh.
      }
    }
    addNotification('CHAT_MESSAGE', `New message in #${channel?.name || 'workspace chat'}`, `${currentUser.name}: ${content.trim()}`, {
      channelId,
      messageId: newMsg.id,
      senderId: currentUser.id,
      workspaceId: activeWorkspaceId,
    });
  }, [currentUser, activeWorkspaceId, activeWorkspace, messages, setWorkspaces, addNotification]);

  const sendTeamMessage = useCallback(async (teamId, content, attachments) => {
    if (!currentUser || !teamId || !content?.trim()) return;

    const newMsg = {
      id: 'msg-' + generateId(),
      teamId,
      workspaceId: activeWorkspaceId,
      userId: currentUser.id,
      content: content.trim(),
      attachments: attachments || [],
      createdAt: new Date().toISOString(),
      updatedAt: null,
      scope: 'TEAM',
    };

    const key = 'team-chat-' + teamId;
    const nextMessages = {
      ...(messages || {}),
      [key]: [...(messages[key] || []), newMsg],
    };
    setMessages(nextMessages);
    if (activeWorkspace) {
      try {
        const saved = await workspacesApi.update(activeWorkspace.id, {
          messages: nextMessages,
          expectedVersion: activeWorkspace.version || 1,
        });
        setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      } catch {
        // Message remains visible locally until the next cloud refresh.
      }
    }
    addActivity('team_message_created', 'Team message created', { teamId });
    addNotification('TEAM_MESSAGE', 'New team message', `${currentUser.name}: ${content.trim()}`, {
      teamId,
      messageId: newMsg.id,
      senderId: currentUser.id,
      workspaceId: activeWorkspaceId,
    });
  }, [currentUser, activeWorkspaceId, activeWorkspace, messages, setWorkspaces, addActivity, addNotification]);

  return {
    messages,
    setMessages,
    channelMessages,
    activeTeamMessages,
    teamMessagesKey,
    createChannel,
    deleteChannel,
    sendMessage,
    sendTeamMessage,
  };
}
