import { useCallback, useState } from 'react';
import { generateId } from '@/services/workspaceService';

export function useWorkspaceActivity(currentUser) {
  const [activityFeed, setActivityFeed] = useState([]);

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
    setActivityFeed((prev) => [activity, ...prev].slice(0, 50));
    return activity;
  }, [currentUser]);

  return {
    activityFeed,
    setActivityFeed,
    addActivity,
  };
}
