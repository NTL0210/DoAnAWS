'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

function getDefaultSignalingUrl() {
  if (process.env.NEXT_PUBLIC_VOICE_SERVER_URL) return process.env.NEXT_PUBLIC_VOICE_SERVER_URL;
  if (process.env.NEXT_PUBLIC_SIGNALING_URL) return process.env.NEXT_PUBLIC_SIGNALING_URL;
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const { hostname, port } = window.location;

  // Local dev — connect to the signaling server on the same machine
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3001';

  // Dev tunnel / cloud IDE — the tunnel only forwards the app port (3000),
  // NOT the signaling port (3001).  Fall back to localhost so we don't hang
  // on a non-existent tunnel endpoint.
  if (
    hostname.includes('-3000.') ||    // VS Code / assible dev tunnel
    hostname.endsWith('.devtunnels.ms') ||
    hostname.endsWith('.preview.app.github.dev') ||
    hostname.endsWith('.csb.app')            // CodeSandbox
  ) {
    return 'http://localhost:3001';
  }

  // Same host, different port (e.g. bare IP address or custom domain)
  if (port) return `//${hostname}:3001`;   // protocol-relative URL
  return `//${hostname}:3001`;
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
    if (socketRef.current?.connected) return;

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
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
        if (missedPongRef.current >= 3) setHeartbeatLost(true);
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
