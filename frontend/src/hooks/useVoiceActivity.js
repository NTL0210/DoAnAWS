'use client';

import { useEffect, useRef, useState } from 'react';

const DEBUG = process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

/**
 * Detects voice activity from the real microphone stream without modifying it.
 * audioLevel is normalized to 0..1 for UI meters.
 *
 * Accepts a MediaStream or MediaStreamTrack.
 * Uses requestAnimationFrame for smooth level tracking.
 * AudioContext is created inside a user-gesture-friendly path.
 */
export default function useVoiceActivity(input, options = {}) {
  const {
    enabled = true,
    isMuted = false,
    settings = {},
    minThreshold = 0.012,
    noiseMultiplier = 2.5,
    smoothing = 0.75,
    speakingHoldMs = 250,
    uiUpdateMs = 80,
    sourceLabel = 'voice',
  } = options;

  const [state, setState] = useState({
    audioLevel: 0,
    isSpeaking: false,
    hasAudioInput: false,
    rawRms: 0,
    peak: 0,
    clippingRisk: false,
  });

  const optionsRef = useRef({ enabled, isMuted, settings, minThreshold, noiseMultiplier, smoothing, speakingHoldMs, uiUpdateMs, sourceLabel });
  const rafRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const lastUiUpdateRef = useRef(0);
  const lastSpeakingAtRef = useRef(0);
  const smoothedLevelRef = useRef(0);
  const noiseFloorRef = useRef(0.006);
  const warnedEndedRef = useRef(false);
  const streamRef = useRef(null);

  useEffect(() => {
    optionsRef.current = { enabled, isMuted, settings, minThreshold, noiseMultiplier, smoothing, speakingHoldMs, uiUpdateMs, sourceLabel };
  }, [enabled, isMuted, settings, minThreshold, noiseMultiplier, smoothing, speakingHoldMs, uiUpdateMs, sourceLabel]);

  useEffect(() => {
    function cleanup() {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try { sourceRef.current?.disconnect(); } catch { /* best effort */ }
      sourceRef.current = null;
      analyserRef.current = null;
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
      const stream = streamRef.current;
      if (stream) {
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.removeEventListener('ended', handleTrackEnded);
        }
        if (input instanceof MediaStreamTrack) {
          stream.getTracks().forEach((t) => t.stop());
        }
      }
      streamRef.current = null;
      // Do NOT reset warnedEndedRef here — it persists across cleanup/setup cycles
      // so a stale track doesn't trigger re-warn. It's only cleared when a live track is detected.
    }

    if (!enabled || !input) {
      setState((prev) =>
        prev.audioLevel === 0 && !prev.isSpeaking && !prev.hasAudioInput
          ? prev
          : { audioLevel: 0, isSpeaking: false, hasAudioInput: false, rawRms: 0, peak: 0, clippingRisk: false }
      );
      return cleanup;
    }

    // Resolve input to a MediaStream + track
    let stream;
    if (input instanceof MediaStream) {
      const audioTrack = input.getAudioTracks()[0];
      if (!audioTrack) {
        if (DEBUG) console.warn('[useVoiceActivity] No audio track in stream for', sourceLabel);
        setState((prev) => prev.hasAudioInput ? { audioLevel: 0, isSpeaking: false, hasAudioInput: false, rawRms: 0, peak: 0, clippingRisk: false } : prev);
        return cleanup;
      }
      stream = input;
    } else if (input instanceof MediaStreamTrack && input.kind === 'audio') {
      stream = new MediaStream([input]);
    } else {
      if (DEBUG) console.warn('[useVoiceActivity] Invalid input type for', sourceLabel, typeof input);
      return cleanup;
    }

    const track = stream.getAudioTracks()[0];

    if (!track || track.readyState !== 'live' || !track.enabled) {
      if (!warnedEndedRef.current) {
        console.warn(`[useVoiceActivity] Track not usable for ${sourceLabel}:`, {
          exists: !!track,
          readyState: track?.readyState,
          enabled: track?.enabled,
        });
        warnedEndedRef.current = true;
      }
      setState((prev) => prev.hasAudioInput ? { audioLevel: 0, isSpeaking: false, hasAudioInput: false, rawRms: 0, peak: 0, clippingRisk: false } : prev);
      return cleanup;
    }
    // Reset warn flag — we have a live track, future ended-tracks should warn again
    warnedEndedRef.current = false;

    streamRef.current = stream;

    const handleTrackEnded = () => {
      if (DEBUG) console.warn('[useVoiceActivity] Track ended for', sourceLabel);
      cleanup();
      // Trigger a reset
      setState((prev) =>
        prev.audioLevel === 0 && !prev.isSpeaking && !prev.hasAudioInput
          ? prev
          : { audioLevel: 0, isSpeaking: false, hasAudioInput: false, rawRms: 0, peak: 0, clippingRisk: false }
      );
    };
    track.addEventListener('ended', handleTrackEnded);

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      if (DEBUG) console.warn('[useVoiceActivity] AudioContext not available');
      return cleanup;
    }

    try {
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Resume if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          // Silently fail — some browsers require user gesture
        });
      }

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const data = new Uint8Array(analyser.fftSize);

      function tick(now) {
        if (audioContext.state === 'closed' || !analyserRef.current) return;

        const currentTrack = stream.getAudioTracks()[0];

        // Check track health + mute state
        if (!currentTrack || currentTrack.readyState !== 'live' || optionsRef.current.isMuted || !currentTrack.enabled) {
          // Track ended permanently — stop RAF completely. The effect will re-init
          // when a new live track is provided via dependency change.
          if (!currentTrack || currentTrack.readyState !== 'live') {
            smoothedLevelRef.current = 0;
            lastUiUpdateRef.current = 0;
            setState((prev) => {
              if (prev.audioLevel === 0 && !prev.isSpeaking && !prev.hasAudioInput) return prev;
              return { audioLevel: 0, isSpeaking: false, hasAudioInput: false, rawRms: 0, peak: 0, clippingRisk: false };
            });
            return; // Stop RAF — track is dead
          }
          // Muted but live — keep RAF running, just zero the level
          smoothedLevelRef.current = 0;
          lastUiUpdateRef.current = 0;
          setState((prev) => {
            if (prev.audioLevel === 0 && !prev.isSpeaking) return prev;
            return { audioLevel: 0, isSpeaking: false, hasAudioInput: true, rawRms: 0, peak: 0, clippingRisk: false };
          });
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        // Check AudioContext state
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {});
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        analyser.getByteTimeDomainData(data);

        let sumSquares = 0;
        let currentPeak = 0;
        for (let i = 0; i < data.length; i += 1) {
          const normalized = (data[i] - 128) / 128;
          const abs = Math.abs(normalized);
          if (abs > currentPeak) currentPeak = abs;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / data.length);

        // Adaptive noise floor
        if (rms < noiseFloorRef.current * 1.5) {
          noiseFloorRef.current = noiseFloorRef.current * 0.95 + rms * 0.05;
        }

        // Apply settings-based multipliers (same as before for compatibility)
        const appliedSettings = optionsRef.current.settings;
        const inputVolume = clamp(appliedSettings.inputVolume ?? 100, 0, 100) / 100;
        const micBoost = appliedSettings.softVoiceMode
          ? Math.max(Number(appliedSettings.micBoost) || 1, 3)
          : Number(appliedSettings.micBoost) || 2;

        // Compute smoothed level
        const rawLevel = Math.min(1, rms * micBoost * inputVolume * 8);
        const prev = smoothedLevelRef.current;
        const smoothed = prev + (rawLevel - prev) * (1 - (optionsRef.current.smoothing ?? 0.75));
        smoothedLevelRef.current = smoothed;

        // Threshold
        const threshold = Math.max(
          optionsRef.current.minThreshold,
          noiseFloorRef.current * (optionsRef.current.noiseMultiplier ?? 2.5)
        );

        // Speaking detection with hold
        if (smoothed > threshold) {
          lastSpeakingAtRef.current = now;
        }
        const isSpeakingNow = now - lastSpeakingAtRef.current < (optionsRef.current.speakingHoldMs ?? 250);

        // Clipping detection
        const clippingRisk = currentPeak > 0.98;

        // Throttle UI updates
        if (now - lastUiUpdateRef.current >= (optionsRef.current.uiUpdateMs ?? 80)) {
          lastUiUpdateRef.current = now;

          const roundedLevel = Number(smoothed.toFixed(4));
          const roundedRms = Number(rms.toFixed(4));
          const roundedPeak = Number(currentPeak.toFixed(4));

          setState((prevState) => {
            // Only re-render if something meaningful changed
            if (
              Math.abs(prevState.audioLevel - roundedLevel) < 0.003 &&
              prevState.isSpeaking === isSpeakingNow &&
              prevState.hasAudioInput === true &&
              Math.abs(prevState.rawRms - roundedRms) < 0.001 &&
              prevState.clippingRisk === clippingRisk
            ) {
              return prevState;
            }
            return {
              audioLevel: roundedLevel,
              isSpeaking: isSpeakingNow,
              hasAudioInput: true,
              rawRms: roundedRms,
              peak: roundedPeak,
              clippingRisk,
            };
          });
        }

        rafRef.current = requestAnimationFrame(tick);
      }

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      if (DEBUG) console.warn('[useVoiceActivity] Failed to initialize:', err.message);
      cleanup();
    }

    return cleanup;
  }, [
    enabled,
    input,
    minThreshold,
    noiseMultiplier,
    smoothing,
    speakingHoldMs,
    uiUpdateMs,
    sourceLabel,
  ]);

  return state;
}
