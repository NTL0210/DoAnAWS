'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { generateId } from '@/lib/workspaceData';
import { normalizeVoiceChannel } from '@/lib/voicePermissions';
import { getGlobalSocket } from '@/context/VoiceConnectionContext';
import { workspacesApi, workspaceAttachmentsApi } from '@/services/cloudClient';

function messageKeyForChannel(channelId) {
  return channelId;
}

function messageKeyForTeam(teamId) {
  return 'team-chat-' + teamId;
}

function sortMessages(items = []) {
  return [...items].sort((a, b) => {
    const left = Date.parse(a.createdAt || 0);
    const right = Date.parse(b.createdAt || 0);
    return (Number.isNaN(left) ? 0 : left) - (Number.isNaN(right) ? 0 : right);
  });
}

function appendMessage(collection = {}, key, message) {
  if (!key || !message?.id) return collection || {};
  const existing = Array.isArray(collection?.[key]) ? collection[key] : [];
  if (existing.some((item) => item.id === message.id)) return collection || {};
  return {
    ...(collection || {}),
    [key]: sortMessages([...existing, message]),
  };
}

function mergeMessageCollections(base = {}, incoming = {}) {
  const next = { ...(base || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (!Array.isArray(value)) {
      next[key] = value;
      return;
    }
    const byId = new Map((Array.isArray(next[key]) ? next[key] : []).map((item) => [item.id, item]));
    value.forEach((item) => {
      if (item?.id) byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
    });
    next[key] = sortMessages(Array.from(byId.values()));
  });
  return next;
}

async function uploadChatAttachments(workspaceId, files = []) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!workspaceId || selected.length === 0) return [];

  return Promise.all(selected.map(async (file) => {
    const attachment = await workspaceAttachmentsApi.createUploadUrl(workspaceId, {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size || 0,
    });
    const upload = await fetch(attachment.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!upload.ok) throw new Error('Attachment upload failed.');
    return {
      id: attachment.id,
      name: file.name,
      size: file.size || 0,
      type: file.type || 'application/octet-stream',
      storageKey: attachment.storageKey,
      url: attachment.downloadUrl,
      downloadUrl: attachment.downloadUrl,
      expiresAt: attachment.expiresAt,
      createdAt: new Date().toISOString(),
    };
  }));
}

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
 *   sendTyping: (targetId: string, channelType?: string) => void,
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
}) {
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    setMessages(activeWorkspace?.messages || {});
  }, [activeWorkspace?.id, activeWorkspace?.messages]);

  useEffect(() => {
    function handleRealtime(event) {
      const detail = event.detail || {};
      if (detail.workspaceId !== activeWorkspaceId) return;
      if (detail.type === 'CHAT_TYPING') {
        const payload = detail.payload || {};
        if (!payload.targetId || payload.userId === currentUser?.id) return;
        const key = `${payload.channelType || 'channel'}:${payload.targetId}`;
        setTypingUsers((prev) => ({
          ...prev,
          [key]: {
            userId: payload.userId,
            name: payload.userName || payload.email || 'Someone',
            avatar: payload.userAvatar || null,
            lastTypedAt: Date.now(),
          },
        }));
        setTimeout(() => {
          setTypingUsers((prev) => {
            const current = prev[key];
            if (!current || Date.now() - current.lastTypedAt < 950) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 1000);
        return;
      }
      if (detail.type !== 'CHAT_MESSAGE' && detail.type !== 'TEAM_MESSAGE') return;
      const payload = detail.payload || {};
      if (payload.message) {
        const key = payload.message.scope === 'TEAM'
          ? messageKeyForTeam(payload.message.teamId)
          : messageKeyForChannel(payload.message.channelId);
        setMessages((prev) => appendMessage(prev, key, payload.message));
      } else if (payload.messages) {
        setMessages((prev) => mergeMessageCollections(prev, payload.messages));
      }
      if (payload.workspace?.id) {
        setWorkspaces((prev) =>
          prev.map((ws) => (
            ws.id === payload.workspace.id
              ? { ...payload.workspace, messages: mergeMessageCollections(ws.messages, payload.workspace.messages) }
              : ws
          ))
        );
      }
    }

    window.addEventListener('workspace:realtime', handleRealtime);
    return () => window.removeEventListener('workspace:realtime', handleRealtime);
  }, [activeWorkspaceId, currentUser?.id, setWorkspaces]);

  // ─── Derived ───────────────────────────────────────────
  const channelMessages = useMemo(() => {
    if (!activeChannelId) return [];
    return sortMessages(messages[activeChannelId] || []);
  }, [messages, activeChannelId]);

  const teamMessagesKey = activeTeamId ? 'team-chat-' + activeTeamId : null;

  const activeTeamMessages = useMemo(() => {
    if (!teamMessagesKey) return [];
    return sortMessages(messages[teamMessagesKey] || []);
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
  const persistAppendedMessage = useCallback(async (messageKey, newMsg, retries = 1) => {
    if (!activeWorkspace?.id) return null;
    let latest = await workspacesApi.get(activeWorkspace.id);
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const nextMessages = appendMessage(latest.messages || {}, messageKey, newMsg);
      try {
        return await workspacesApi.update(activeWorkspace.id, {
          messages: nextMessages,
          expectedVersion: latest.version || 1,
        });
      } catch (err) {
        if (err?.statusCode !== 409 || attempt >= retries) throw err;
        latest = await workspacesApi.get(activeWorkspace.id);
      }
    }
    return null;
  }, [activeWorkspace?.id]);

  const sendMessage = useCallback(async (channelId, content, attachments) => {
    if (!currentUser || !content?.trim()) return;
    const channel = activeWorkspace?.channels?.find((item) => item.id === channelId);
    const uploadedAttachments = await uploadChatAttachments(activeWorkspaceId, attachments);

    const newMsg = {
      id: 'msg-' + generateId(),
      channelId,
      workspaceId: activeWorkspaceId,
      userId: currentUser.id,
      userName: currentUser.name || currentUser.email || 'User',
      userEmail: currentUser.email || '',
      userAvatar: currentUser.avatar || null,
      content: content.trim(),
      attachments: uploadedAttachments,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    const messageKey = messageKeyForChannel(channelId);
    setMessages((prev) => appendMessage(prev, messageKey, newMsg));
    if (activeWorkspace) {
      try {
        const saved = await persistAppendedMessage(messageKey, newMsg);
        setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
        getGlobalSocket()?.emit('workspace:event', {
          workspaceId: activeWorkspaceId,
          type: 'CHAT_MESSAGE',
          payload: { message: newMsg, workspace: saved },
        });
      } catch {
        // Message remains visible locally until the next cloud refresh.
      }
    }
  }, [currentUser, activeWorkspaceId, activeWorkspace, setWorkspaces, persistAppendedMessage]);

  const sendTeamMessage = useCallback(async (teamId, content, attachments) => {
    if (!currentUser || !teamId || !content?.trim()) return;
    const uploadedAttachments = await uploadChatAttachments(activeWorkspaceId, attachments);

    const newMsg = {
      id: 'msg-' + generateId(),
      teamId,
      workspaceId: activeWorkspaceId,
      userId: currentUser.id,
      userName: currentUser.name || currentUser.email || 'User',
      userEmail: currentUser.email || '',
      userAvatar: currentUser.avatar || null,
      content: content.trim(),
      attachments: uploadedAttachments,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      scope: 'TEAM',
    };

    const key = messageKeyForTeam(teamId);
    setMessages((prev) => appendMessage(prev, key, newMsg));
    if (activeWorkspace) {
      try {
        const saved = await persistAppendedMessage(key, newMsg);
        setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
        getGlobalSocket()?.emit('workspace:event', {
          workspaceId: activeWorkspaceId,
          type: 'TEAM_MESSAGE',
          payload: { message: newMsg, workspace: saved },
        });
      } catch {
        // Message remains visible locally until the next cloud refresh.
      }
    }
    addActivity('team_message_created', 'Team message created', { teamId });
  }, [currentUser, activeWorkspaceId, activeWorkspace, setWorkspaces, addActivity, persistAppendedMessage]);

  const sendTyping = useCallback((targetId, channelType = 'channel') => {
    if (!targetId || !currentUser?.id || !activeWorkspaceId) return;
    getGlobalSocket()?.emit('workspace:event', {
      workspaceId: activeWorkspaceId,
      type: 'CHAT_TYPING',
      payload: {
        targetId,
        channelType,
        userId: currentUser.id,
        userName: currentUser.name || currentUser.email || 'User',
        userAvatar: currentUser.avatar || null,
        email: currentUser.email || '',
      },
    });
  }, [activeWorkspaceId, currentUser]);

  return {
    messages,
    setMessages,
    typingUsers,
    channelMessages,
    activeTeamMessages,
    teamMessagesKey,
    createChannel,
    deleteChannel,
    sendMessage,
    sendTeamMessage,
    sendTyping,
  };
}
