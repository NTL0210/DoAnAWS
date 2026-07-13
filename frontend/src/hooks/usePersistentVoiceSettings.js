'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';

const MAX_REMOTE_VOLUME = VOICE_AUDIO_CONFIG.maxRemotePlaybackGain ?? 2;

export const DEFAULT_VOICE_SETTINGS = {
  selectedMicId: null,
  inputDeviceId: '',
  outputDeviceId: '',
  outputVolume: 1,
  perUserVolumes: {},
  noiseSuppressionMode: VOICE_AUDIO_CONFIG.noiseSuppressionMode,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  inputSensitivity: 0.025,
  inputVolume: 100,
  micBoost: 2,
  micGain: VOICE_AUDIO_CONFIG.micGain,
  noiseGateThreshold: VOICE_AUDIO_CONFIG.noiseGateThreshold,
  noiseGateReduction: VOICE_AUDIO_CONFIG.noiseGateReduction,
  softVoiceMode: false,
  noiseFloor: 0.008,
  localRecordingGain: VOICE_AUDIO_CONFIG.recordingLocalGain,
  remoteRecordingGain: VOICE_AUDIO_CONFIG.recordingRemoteGain,
  recordingQuality: 'high',
  pushToTalk: false,
  deafen: false,
};

function storageKey(userId, workspaceId) {
  return `voiceSettings_${workspaceId || 'default'}_${userId || 'anonymous'}`;
}

function legacyStorageKey(userId, workspaceId) {
  return `aiWorkforce_voiceSettings_${userId || 'anonymous'}_${workspaceId || 'default'}`;
}

function normalizeNoiseSuppressionMode(mode) {
  if (['dtln-ai', 'future-krisp', 'future-rnnoise'].includes(mode)) {
    return VOICE_AUDIO_CONFIG.noiseSuppressionMode;
  }
  return mode || VOICE_AUDIO_CONFIG.noiseSuppressionMode;
}

function normalizeRemoteVolume(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(MAX_REMOTE_VOLUME, numeric));
}

function normalizePerUserVolumes(perUserVolumes) {
  if (!perUserVolumes || typeof perUserVolumes !== 'object') return {};
  return Object.fromEntries(
    Object.entries(perUserVolumes).map(([userId, volume]) => [
      userId,
      normalizeRemoteVolume(volume),
    ])
  );
}

export default function usePersistentVoiceSettings(userId, workspaceId) {
  const key = useMemo(() => storageKey(userId, workspaceId), [userId, workspaceId]);
  const [settings, setSettings] = useState(DEFAULT_VOICE_SETTINGS);

  useEffect(() => {
    try {
      const legacyKey = legacyStorageKey(userId, workspaceId);
      const stored = window.localStorage.getItem(key) || window.localStorage.getItem(legacyKey);
      const parsed = stored ? JSON.parse(stored) : {};
      const migrated = {
        ...parsed,
        selectedMicId: parsed.selectedMicId ?? parsed.inputDeviceId ?? null,
        inputDeviceId: parsed.inputDeviceId ?? parsed.selectedMicId ?? '',
        noiseSuppressionMode: normalizeNoiseSuppressionMode(parsed.noiseSuppressionMode),
        inputVolume: parsed.inputVolume <= 1 ? Math.round(parsed.inputVolume * 100) : parsed.inputVolume,
        outputVolume: normalizeRemoteVolume(parsed.outputVolume, DEFAULT_VOICE_SETTINGS.outputVolume),
        perUserVolumes: normalizePerUserVolumes(parsed.perUserVolumes),
        inputSensitivity: parsed.inputSensitivity > 1
          ? Math.max(0.005, Math.min(0.08, parsed.inputSensitivity / 720))
          : parsed.inputSensitivity,
      };
      setSettings(stored ? { ...DEFAULT_VOICE_SETTINGS, ...migrated } : DEFAULT_VOICE_SETTINGS);
    } catch {
      setSettings(DEFAULT_VOICE_SETTINGS);
    }
  }, [key, userId, workspaceId]);

  const saveSettings = useCallback((updater) => {
    setSettings((prev) => {
      const patch = typeof updater === 'function' ? updater(prev) : updater;
      const normalizedPatch = { ...patch };
      if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'selectedMicId')) {
        normalizedPatch.inputDeviceId = normalizedPatch.selectedMicId || '';
      }
      if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'inputDeviceId')) {
        normalizedPatch.selectedMicId = normalizedPatch.inputDeviceId || null;
      }
      const next = { ...prev, ...normalizedPatch };
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage is best-effort.
      }
      return next;
    });
  }, [key]);

  const updateSetting = useCallback((name, value) => {
    saveSettings({ [name]: value });
  }, [saveSettings]);

  const setPerUserVolume = useCallback((targetUserId, volume) => {
    if (!targetUserId) return;
    const normalized = normalizeRemoteVolume(volume);
    saveSettings((prev) => ({
      perUserVolumes: {
        ...(prev.perUserVolumes || {}),
        [targetUserId]: normalized,
      },
    }));
  }, [saveSettings]);

  return { settings, updateSetting, saveSettings, setPerUserVolume };
}
