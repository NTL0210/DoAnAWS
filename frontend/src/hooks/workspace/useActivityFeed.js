'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { generateId } from '@/lib/workspaceData';

/**
 * useActivityFeed — manages activity feed and notification state.
 *
 * Uses a ref for activeWorkspaceId to avoid circular dependency with useWorkspaceState.
 * The Provider MUST sync activeWorkspaceIdRef.current on every render.
 *
 * @param {Object} params
 * @param {Object|null} params.currentUser
 * @returns {{
 *   activityFeed: Array,
 *   setActivityFeed: Function,
 *   addActivity: (type: string, message: string, metadata?: Object) => Object,
 *   aiNotifications: Array,
 *   setAiNotifications: Function,
 *   addNotification: (type: string, title: string, message: string, metadata?: Object) => Object|null,
 *   markNotificationRead: (notificationId: string) => void,
 *   markAllNotificationsRead: () => void,
 *   workspaceNotificationsEnabled: boolean,
 *   workspaceNotificationSettings: Object,
 *   setWorkspaceNotificationSettings: Function,
 *   setWorkspaceNotificationsEnabled: (workspaceId: string, enabled: boolean) => void,
 *   toggleWorkspaceNotifications: (workspaceId?: string) => void,
 *   activeWorkspaceIdRef: React.MutableRefObject,
 * }}
 */
export default function useActivityFeed({ currentUser }) {
  const [activityFeed, setActivityFeed] = useState([]);
  const [aiNotifications, setAiNotifications] = useState([]);
  const [workspaceNotificationSettings, setWorkspaceNotificationSettings] = useState({});
  const activeWorkspaceIdRef = useRef(null);

  // ─── Load notification settings from localStorage ──────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('workspaceNotificationSettings');
      setWorkspaceNotificationSettings(stored ? JSON.parse(stored) : {});
    } catch {
      setWorkspaceNotificationSettings({});
    }
  }, []);

  // ─── Persist notification settings ─────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('workspaceNotificationSettings', JSON.stringify(workspaceNotificationSettings));
    } catch {
      // Storage is best-effort.
    }
  }, [workspaceNotificationSettings]);

  // ─── Activity Actions ──────────────────────────────────
  const addActivity = useCallback((type, message, metadata = {}) => {
    const activity = {
      id: 'act-' + generateId(),
      type,
      message,
      userId: currentUser?.id || null,
      userName: currentUser?.name || 'System',
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    setActivityFeed((prev) => [activity, ...prev].slice(0, 50)); // Keep last 50
    return activity;
  }, [currentUser]);

  const addNotification = useCallback((type, title, message, metadata = {}) => {
    const targetWorkspaceId = metadata.workspaceId || activeWorkspaceIdRef.current;
    if (metadata.respectWorkspaceMute !== false && workspaceNotificationSettings[targetWorkspaceId] === false) {
      return null;
    }
    const notification = {
      id: 'ntf-' + generateId(),
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
      workspaceId: targetWorkspaceId,
      ...metadata,
    };
    setAiNotifications((prev) => [notification, ...prev].slice(0, 50));
    return notification;
  }, [workspaceNotificationSettings]);

  const markNotificationRead = useCallback((notificationId) => {
    setAiNotifications((prev) => prev.map((item) =>
      item.id === notificationId ? { ...item, isRead: true, unread: false } : item
    ));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setAiNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, unread: false })));
  }, []);

  const workspaceNotificationsEnabled = workspaceNotificationSettings[activeWorkspaceIdRef.current] !== false;

  const setWorkspaceNotificationsEnabled = useCallback((workspaceId, enabled) => {
    if (!workspaceId) return;
    setWorkspaceNotificationSettings((prev) => ({
      ...prev,
      [workspaceId]: Boolean(enabled),
    }));
  }, []);

  const toggleWorkspaceNotifications = useCallback((workspaceId) => {
    const targetId = workspaceId || activeWorkspaceIdRef.current;
    if (!targetId) return;
    setWorkspaceNotificationSettings((prev) => ({
      ...prev,
      [targetId]: prev[targetId] === false,
    }));
  }, []);

  return {
    activityFeed,
    setActivityFeed,
    addActivity,
    aiNotifications,
    setAiNotifications,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    workspaceNotificationsEnabled,
    workspaceNotificationSettings,
    setWorkspaceNotificationSettings,
    setWorkspaceNotificationsEnabled,
    toggleWorkspaceNotifications,
    activeWorkspaceIdRef,
  };
}
