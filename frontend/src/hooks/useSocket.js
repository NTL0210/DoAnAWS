'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAuthToken, isCloudMode } from '@/services/apiClient';

function isCloudModeNoSignalingUrl() {
  if (process.env.NEXT_PUBLIC_VOICE_SERVER_URL) return false;
  if (process.env.NEXT_PUBLIC_SIGNALING_URL) return false;
  return isCloudMode();
}

function getDefaultSignalingUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || process.env.NEXT_PUBLIC_SIGNALING_URL;
  if (configuredUrl) return normalizeSignalingUrl(configuredUrl);
  if (typeof window === 'undefined') return 'http://localhost:3001';

  const { hostname, port } = window.location;

  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3001';
  if (
    hostname.includes('-3000.') ||
    hostname.endsWith('.devtunnels.ms') ||
    hostname.endsWith('.preview.app.github.dev') ||
    hostname.endsWith('.csb.app')
  ) {
    return 'http://localhost:3001';
  }

  if (hostname.endsWith('.cloudfront.net')) return window.location.origin;
  if (isCloudModeNoSignalingUrl()) return '';

  if (port) return `//${hostname}:3001`;
  return `//${hostname}:3001`;
}

function normalizeSignalingUrl(configuredUrl) {
  if (typeof window === 'undefined') return configuredUrl;
  const value = String(configuredUrl || '').trim();
  if (!value) return value;

  if (window.location.protocol === 'https:' && value.startsWith('http://')) {
    return window.location.origin;
  }

  return value;
}

export default function useSocket(options = {}) {
  const { url = getDefaultSignalingUrl(), autoConnect = true } = options;

  const socketRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const missedPongRef = useRef(0);
  const listenersRef = useRef(new Map());
  const [connected, setConnected] = useState(false);
  const [socketInstance, setSocketInstance] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [lastPongAt, setLastPongAt] = useState(null);
  const [heartbeatLost, setHeartbeatLost] = useState(false);
  const [lastSocketEvent, setLastSocketEvent] = useState('');

  const connectionQuality = !connected || heartbeatLost
    ? 'disconnected'
    : latencyMs === null
      ? 'measuring'
      : latencyMs < 150
        ? 'good'
        : latencyMs < 300
          ? 'medium'
          : 'poor';

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const clearPongTimeout = useCallback(() => {
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected || !url) return;

    const socket = io(url, {
      // CloudFront/ALB accepts the Socket.IO polling handshake reliably, then
      // upgrades to websocket when that path is available.
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
      auth: {
        token: getAuthToken() || undefined,
      },
    });

    socket.on('connect', () => {
      setLastSocketEvent('connect');
      setConnected(true);
      setLatencyMs(null);
      setHeartbeatLost(false);
      missedPongRef.current = 0;
    });

    socket.on('disconnect', (reason) => {
      setLastSocketEvent(`disconnect:${reason}`);
      setConnected(false);
      setLatencyMs(null);
      setLastPongAt(null);
      setHeartbeatLost(true);
      clearPingInterval();
      clearPongTimeout();
    });

    socket.on('connect_error', (error) => {
      setLastSocketEvent(`connect_error:${error?.message || 'unknown'}`);
      setConnected(false);
      setLatencyMs(null);
    });

    socket.on('voice-pong', ({ timestamp } = {}) => {
      if (!timestamp) return;
      setLastSocketEvent('voice-pong');
      clearPongTimeout();
      missedPongRef.current = 0;
      setHeartbeatLost(false);
      setLatencyMs(Date.now() - timestamp);
      setLastPongAt(new Date().toISOString());
    });

    socketRef.current = socket;
    setSocketInstance(socket);
  }, [clearPingInterval, clearPongTimeout, url]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketInstance(null);
    clearPingInterval();
    clearPongTimeout();
    setConnected(false);
    setLatencyMs(null);
    setLastPongAt(null);
    setHeartbeatLost(true);
  }, [clearPingInterval, clearPongTimeout]);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  useEffect(() => {
    if (!connected || !socketRef.current) return undefined;
    const sendPing = () => {
      const sock = socketRef.current;
      if (!sock?.connected) return;
      clearPongTimeout();
      sock.emit('voice-ping', { timestamp: Date.now() });
      pongTimeoutRef.current = setTimeout(() => {
        missedPongRef.current += 1;
        if (missedPongRef.current >= 3) {
          setHeartbeatLost(true);
          if (sock.connected) {
            sock.disconnect();
            window.setTimeout(() => sock.connect(), 250);
          }
        }
      }, 6000);
    };
    sendPing();
    clearPingInterval();
    pingIntervalRef.current = setInterval(sendPing, 5000);
    return () => {
      clearPingInterval();
      clearPongTimeout();
    };
  }, [clearPingInterval, clearPongTimeout, connected]);

  useEffect(() => {
    const reconnectIfNeeded = () => {
      const sock = socketRef.current;
      if (!sock || sock.connected) return;
      sock.connect();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconnectIfNeeded();
    };
    window.addEventListener('online', reconnectIfNeeded);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', reconnectIfNeeded);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const emit = useCallback((event, data) => {
    setLastSocketEvent(`emit:${event}`);
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on(event, handler);
    const eventListeners = listenersRef.current.get(event) || [];
    eventListeners.push(handler);
    listenersRef.current.set(event, eventListeners);

    return () => {
      socketRef.current?.off(event, handler);
      const updated = (listenersRef.current.get(event) || []).filter((h) => h !== handler);
      if (updated.length === 0) listenersRef.current.delete(event);
      else listenersRef.current.set(event, updated);
    };
  }, []);

  return {
    connected,
    connectionQuality,
    emit,
    on,
    socket: socketInstance,
    connect,
    disconnect,
    latencyMs,
    lastPongAt,
    url,
    heartbeatLost,
    lastSocketEvent,
  };
}
