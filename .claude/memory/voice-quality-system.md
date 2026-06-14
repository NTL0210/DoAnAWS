---
name: voice-quality-system
description: Voice Quality System implementation details (VAD, noise suppression, avatar glow, settings)
metadata:
  type: reference
---

# Voice Quality System

Implemented on 2026-06-08. Files changed/created:

## New files
- `src/hooks/useVoiceActivity.js` — Web Audio API-based VAD hook. Uses `AudioContext` + `AnalyserNode` + `getByteTimeDomainData`. RMS-based audio level detection with configurable sensitivity (1-255), speaking delay (150ms), silence delay (400ms). Returns `{ isSpeaking, audioLevel }` without causing global re-renders (uses refs internally).

## Modified files
- `src/context/WorkspaceContext.jsx` — Added `isSpeaking: false` and `audioLevel: 0` to participant model in `joinVoiceChannel`. Added `updateVoiceParticipantState(channelId, userId, updates)` function exposed in context.

- `src/components/channels/VoiceChannelView.jsx` — Major update:
  - Voice settings state persisted to localStorage (noiseSuppression, echoCancellation, autoGainControl, inputSensitivity, pushToTalk)
  - Mic stream for VAD acquired on join via `getUserMedia` with advanced audio constraints
  - `useVoiceActivity` hook connected when joined and not muted
  - `isSpeaking` changes synced to global participant state only on true→false/false→true transitions (not every frame)
  - Avatar component with emerald ring glow when speaking, opacity/greyscale when muted, recording indicator
  - `AudioLevelMeter` component (5-bar visualizer)
  - Mute/unmute controls actual audio track `enabled` property
  - `VoiceSettingsModal` with toggle switches for noise suppression, echo cancellation, auto gain control, push-to-talk, and input sensitivity slider
  - Push-to-talk: hold Space key to talk, mic muted by default when enabled
  - Browser compatibility fallback: if advanced constraints fail, falls back to `{ audio: true }`

- `src/components/layout/ChannelSidebar.jsx` — Voice channel buttons now show participant list with green/red/gray presence dots, speaking indicator (emerald mic icon), and mute indicator (mic-off icon).

- `src/components/workspace/WorkspaceChannelView.jsx` — SidebarItem participant avatars show emerald border+glow when speaking, gray when muted.

## Key design decisions
- VAD stream is separate from recording stream (avoids refactoring existing recording flow)
- Audio level meter is local-only (not in global context) to prevent re-render storms
- `isSpeaking` updates to global context only on state transition, not every animation frame
- Voice settings saved to localStorage under key `aiWorkforce_voiceSettings`
