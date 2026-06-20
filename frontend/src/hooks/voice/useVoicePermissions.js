'use client';

import { useState, useCallback, useRef } from 'react';

/* ─── Debug ────────────────────────────────────────────────── */
const VOICE_DEBUG = process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

/**
 * useVoicePermissions — manages mic permission modals, consents, and settings overlays.
 *
 * @param {Object} params
 * @param {boolean} params.joined
 * @param {boolean} params.muted
 * @param {boolean} params.isMicEnabled
 * @param {Function} params.setMuted
 * @param {Function} params.toggleMute
 * @param {Function} params.showToast
 * @returns {Object} permission state and actions
 */
export default function useVoicePermissions({
  joined,
  muted,
  isMicEnabled,
  setMuted,
  toggleMute,
  showToast,
}) {
  // ─── Permission message state ─────────────────────────
  const [permissionMessage, setPermissionMessage] = useState(null);
  const [showJoinAnyway, setShowJoinAnyway] = useState(false);
  const permissionHandledRef = useRef(false);

  // ─── Settings overlay ─────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  // ─── Debug panel ──────────────────────────────────────
  const [showDebug, setShowDebug] = useState(false);
  const toggleDebug = useCallback(() => setShowDebug((prev) => !prev), []);

  // ─── Nudge joined-but-muted users ──────────────────────
  const nudgedRef = useRef(false);
  const nudgeOnce = useCallback(() => {
    if (joined && muted && !nudgedRef.current) {
      nudgedRef.current = true;
      setTimeout(() => {
        if (!nudgedRef.current) return;
        showToast?.('info', 'You are muted. Click the mic button to unmute yourself.');
      }, 5000);
    }
  }, [joined, muted, showToast]);

  // ─── Permission denied handler ─────────────────────────
  const handlePermissionDenied = useCallback((errorMessage) => {
    if (permissionHandledRef.current) return;
    permissionHandledRef.current = true;

    if (VOICE_DEBUG) console.warn('[VoicePermissions] Permission denied:', errorMessage);

    if (errorMessage && errorMessage.toLowerCase().includes('permission')) {
      setPermissionMessage({
        type: 'permission',
        title: 'Microphone Access Denied',
        description: 'Voice requires microphone access. Please allow microphone access in your browser settings and rejoin.',
        details: errorMessage,
      });
    } else if (errorMessage && errorMessage.toLowerCase().includes('device')) {
      setPermissionMessage({
        type: 'device',
        title: 'No Microphone Found',
        description: 'No microphone device was detected. Please connect a microphone and try again.',
        details: errorMessage,
      });
    } else {
      setPermissionMessage({
        type: 'unknown',
        title: 'Voice Connection Issue',
        description: 'Could not access microphone. Please check your audio settings and try again.',
        details: errorMessage || 'Unknown error',
      });
    }
    setShowJoinAnyway(true);
  }, []);

  // ─── Dismiss permission message ────────────────────────
  const dismissPermissionMessage = useCallback(() => {
    setPermissionMessage(null);
    setShowJoinAnyway(false);
    permissionHandledRef.current = false;
  }, []);

  // ─── Handle join anyway ───────────────────────────────
  const handleJoinAnyway = useCallback(() => {
    dismissPermissionMessage();
    setMuted(true);
  }, [dismissPermissionMessage, setMuted]);

  // ─── Reset permission state (e.g. on leave) ───────────
  const resetPermissionState = useCallback(() => {
    permissionHandledRef.current = false;
    nudgedRef.current = false;
    setPermissionMessage(null);
    setShowJoinAnyway(false);
  }, []);

  return {
    // State
    permissionMessage,
    showJoinAnyway,
    showSettings,
    showDebug,
    // Actions
    openSettings,
    closeSettings,
    toggleDebug,
    handlePermissionDenied,
    dismissPermissionMessage,
    handleJoinAnyway,
    resetPermissionState,
    nudgeOnce,
    /**
     * Full permission modal info derived from permissionMessage.
     * null when no permission issue is active.
     */
    permissionModalInfo: permissionMessage ? {
      show: true,
      type: permissionMessage.type,
      title: permissionMessage.title,
      description: permissionMessage.description,
      details: permissionMessage.details,
      showJoinAnyway,
      onDismiss: dismissPermissionMessage,
      onJoinAnyway: handleJoinAnyway,
    } : { show: false },
  };
}
