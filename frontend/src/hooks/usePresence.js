'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';

const CHANNEL_NAME = 'workspace-presence';
const HEARTBEAT_MS = 30_000;
const STALE_MS = 70_000;
const IDLE_MS = 5 * 60 * 1000;

let broadcastChannel = null;

function getChannel() {
  if (typeof window === 'undefined') return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return broadcastChannel;
}

/**
 * usePresence — Real-time online presence tracking
 *
 * Uses BroadcastChannel for cross-tab sync (no server needed).
 * The current user is always marked online. Other tabs/users
 * broadcast their presence via heartbeats. Stale entries expire.
 * Idle detection runs on mouse/keyboard/scroll activity.
 */
export default function usePresence() {
  const { currentUser, activeWorkspaceId } = useWorkspace();
  const heartbeatRef = useRef(null);
  const idleTimerRef = useRef(null);
  const activityRef = useRef(null);
  const [lastSeen, setLastSeen] = useState(() => Date.now());

  useEffect(() => {
    activityRef.current = Date.now();
  }, []);
  const [status, setStatus] = useState('online');
  const [presenceMap, setPresenceMap] = useState({});

  const userId = currentUser?.id;
  const userName = currentUser?.name;
  const workspaceId = activeWorkspaceId;

  // ── Broadcast our presence ──
  const broadcast = useCallback((presenceStatus) => {
    const channel = getChannel();
    if (!channel || !userId || !workspaceId) return;
    channel.postMessage({
      type: 'presence',
      userId,
      workspaceId,
      name: userName,
      status: presenceStatus || 'online',
      lastSeen: Date.now(),
    });
  }, [userId, userName, workspaceId]);

  // ── Send heartbeat ──
  useEffect(() => {
    if (!userId || !workspaceId) return;

    // Immediate broadcast on mount
    broadcast('online');

    heartbeatRef.current = setInterval(() => {
      broadcast(status);
    }, HEARTBEAT_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // Mark offline on unmount
      broadcast('offline');
    };
  }, [userId, workspaceId, status, broadcast]);

  // ── Mark offline on tab close ──
  useEffect(() => {
    if (!userId) return;
    const handleBeforeUnload = () => {
      broadcast('offline');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [userId, broadcast]);

  // ── Idle detection ──
  useEffect(() => {
    const resetIdle = () => {
      activityRef.current = Date.now();
      if (status === 'idle') setStatus('online');
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, IDLE_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdle));
      clearTimeout(idleTimerRef.current);
    };
  }, [status]);

  // ── Listen for other tabs/users ──
  useEffect(() => {
    const channel = getChannel();
    if (!channel || !workspaceId) return;

    const handleMessage = (event) => {
      const data = event.data;
      if (data?.type !== 'presence') return;
      if (data.workspaceId !== workspaceId) return;

      setPresenceMap((prev) => {
        const next = { ...prev };
        if (data.status === 'offline') {
          delete next[data.userId];
        } else {
          next[data.userId] = {
            userId: data.userId,
            name: data.name || 'Unknown',
            status: data.status,
            lastSeen: data.lastSeen,
          };
        }
        // Clean stale entries (no heartbeat for > STALE_MS)
        const now = Date.now();
        Object.keys(next).forEach((id) => {
          if (now - next[id].lastSeen > STALE_MS) delete next[id];
        });
        return next;
      });
    };

    channel.addEventListener('message', handleMessage);

    // Clean stale entries on a timer
    const cleanInterval = setInterval(() => {
      setPresenceMap((prev) => {
        const now = Date.now();
        const next = {};
        Object.keys(prev).forEach((id) => {
          if (now - prev[id].lastSeen <= STALE_MS) next[id] = prev[id];
        });
        return next;
      });
    }, HEARTBEAT_MS);

    return () => {
      channel.removeEventListener('message', handleMessage);
      clearInterval(cleanInterval);
    };
  }, [workspaceId]);

  // ── Compute lists ──
  const onlineUsers = useMemo(() => {
    return Object.values(presenceMap).filter((u) => u.userId !== userId);
  }, [presenceMap, userId]);

  const currentStatus = useMemo(() => ({
    userId,
    name: userName,
    status,
    lastSeen,
  }), [userId, userName, status, lastSeen]);

  // Update lastSeen when status, user, or name changes
  useEffect(() => {
    setLastSeen(Date.now());
  }, [userId, userName, status]);

  return { onlineUsers, currentStatus };
}
