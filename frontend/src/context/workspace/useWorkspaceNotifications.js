import { useCallback, useState } from 'react';
import { createInitialAiNotifications } from './mockNotifications';

export function useWorkspaceNotifications(activeWorkspaceId) {
  const [aiNotifications, setAiNotifications] = useState(() => createInitialAiNotifications());
  const [notificationCount, setNotificationCount] = useState(3);

  const addNotification = useCallback((type, title, message, metadata = {}) => {
    const notification = {
      id: 'ntf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
      workspaceId: activeWorkspaceId,
      ...metadata,
    };
    setAiNotifications((prev) => [notification, ...prev].slice(0, 50));
    setNotificationCount((count) => count + 1);
    return notification;
  }, [activeWorkspaceId]);

  return {
    aiNotifications,
    notificationCount,
    setNotificationCount,
    addNotification,
  };
}
