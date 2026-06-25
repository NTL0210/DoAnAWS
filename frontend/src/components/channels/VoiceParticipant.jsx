'use client';

import { memo } from 'react';
import { FiMic, FiMicOff, FiVolume2, FiVolumeX } from 'react-icons/fi';
import AudioLevelMeter from './AudioLevelMeter';
import NetworkStatusBadge from './NetworkStatusBadge';

/**
 * VoiceParticipant — Memo'd participant card for voice channels.
 *
 * Only re-renders when its specific props change, preventing
 * unrelated participant updates from affecting this card.
 *
 * @param {Object} props
 * @param {Object}  props.participant      - { userId, joinedAt, role, isMuted, isSpeaking, audioLevel }
 * @param {Object}  props.member           - Workspace member info (name, nickname, avatar)
 * @param {boolean} props.isLocal          - True for the current user
 * @param {boolean} props.isRecorder       - True if this user is recording
 * @param {boolean} props.localMicEnabled  - Whether local mic is active
 * @param {number}  props.localAudioLevel  - Audio level for local user's meter
 * @param {number|null}  props.networkLatency - Ping ms for remote peers
 * @param {boolean} props.remoteStreamAvailable - Whether remote audio stream is available
 */
function VoiceParticipant({
  participant,
  member,
  isLocal = false,
  isRecorder = false,
  localMicEnabled = false,
  localAudioLevel = 0,
  networkLatency = null,
  remoteStreamAvailable = false,
  volume = 1,
  onVolumeChange,
  voiceConnectionState,
  micStatus,
}) {
  const displayName = member?.nickname || member?.name || participant?.name || participant?.userId || 'Unknown';
  const effectiveMuted = participant.isMuted;
  const audioLevel = isLocal ? localAudioLevel : (participant.audioLevel || 0);
  const hasAudibleLevel = !effectiveMuted && audioLevel > 0.008;
  const levelIsActive = audioLevel > 0.004;
  const effectiveSpeaking = isLocal
    ? hasAudibleLevel || participant.isSpeaking
    : (participant.isSpeaking && !effectiveMuted) || hasAudibleLevel;

  // ── Connection status for local user ─────────────────────────
  const connectionStatus = isLocal ? getConnectionStatus(voiceConnectionState, micStatus, effectiveMuted) : null;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition dark:bg-slate-900 ${
        effectiveSpeaking
          ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20'
          : ''
      }`}
    >
      {/* ─── Avatar ──────────────────────────────────────── */}
      <Avatar
        name={displayName}
        recording={isRecorder}
        speaking={effectiveSpeaking}
        muted={effectiveMuted}
        audioLevel={audioLevel}
        connectionStatus={connectionStatus}
      />

      {/* ─── Info ────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`truncate text-sm font-black ${effectiveSpeaking ? 'text-emerald-700' : 'text-slate-800 dark:text-slate-200'}`}>
            {displayName}
            {isLocal ? ' (You)' : ''}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            {participant.role || 'Member'}
          </span>
          {isRecorder ? (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">
              Recording
            </span>
          ) : null}
          {/* ── Connection status badge (local only) ─────────── */}
          {isLocal && connectionStatus ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${connectionStatus.badgeClass}`}>
              {connectionStatus.label}
            </span>
          ) : null}
          {effectiveSpeaking ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600">
              {levelIsActive ? 'Speaking' : 'Speaking'}
            </span>
          ) : levelIsActive && !effectiveMuted && !isLocal ? (
            <span className="rounded-full bg-emerald-50/50 px-2 py-0.5 text-[10px] font-black text-emerald-400">
              Active
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          Joined {formatTime(participant.joinedAt)}
          {effectiveMuted ? ' · Muted' : ''}
        </p>
        {/* Network status for remote peers */}
        {!isLocal && (
          <div className="mt-1">
            <NetworkStatusBadge
              latencyMs={networkLatency}
              connected={participant.connected !== false}
              compact
              showText
              label={`${displayName} ping`}
            />
          </div>
        )}
      </div>

      {/* ─── Right side: meter + mic icon ────────────────── */}
      <div className="flex items-center gap-1.5">
        {isLocal && localMicEnabled ? (
          <AudioLevelMeter level={audioLevel} speaking={effectiveSpeaking || levelIsActive} />
        ) : null}
        {/* Show meter for remote peers too */}
        {!isLocal && remoteStreamAvailable ? (
          <AudioLevelMeter level={audioLevel} speaking={effectiveSpeaking || levelIsActive} />
        ) : null}
        {!isLocal && onVolumeChange ? (
          <div className="flex w-24 items-center gap-1" title={`Local volume ${Math.round(volume * 100)}%`}>
            {volume <= 0 ? <FiVolumeX className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> : <FiVolume2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />}
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500 dark:bg-slate-600"
            />
          </div>
        ) : null}
        {effectiveMuted ? (
          <FiMicOff className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        ) : (
          <FiMic className={`h-4 w-4 ${
            effectiveSpeaking || levelIsActive
              ? 'text-emerald-500'
              : isLocal && connectionStatus?.isLive
                ? 'text-blue-400'
                : 'text-slate-300 dark:text-slate-400'
          }`} />
        )}
      </div>
    </div>
  );
}

export default memo(VoiceParticipant);

/* ══════════════════════════════════════════════════════════════
   Connection status helper — local user mic → server
   ══════════════════════════════════════════════════════════════ */
/**
 * @param {string} [voiceConnectionState]
 * @param {string} [micStatus]
 * @param {boolean} [effectiveMuted]
 * @returns {{ label: string, badgeClass: string, isLive: boolean, dotClass: string }|null}
 */
function getConnectionStatus(voiceConnectionState, micStatus, effectiveMuted) {
  if (!voiceConnectionState) return null;

  switch (voiceConnectionState) {
    case 'requesting-mic':
      return { label: 'Requesting mic…', badgeClass: 'bg-amber-50 text-amber-600', isLive: false, dotClass: 'bg-amber-400' };
    case 'connecting':
      return { label: 'Connecting…', badgeClass: 'bg-amber-50 text-amber-600', isLive: false, dotClass: 'bg-amber-400' };
    case 'reconnecting':
      return { label: 'Reconnecting…', badgeClass: 'bg-amber-50 text-amber-600', isLive: false, dotClass: 'bg-amber-500' };
    case 'poor':
      return { label: 'Unstable', badgeClass: 'bg-amber-50 text-amber-700', isLive: true, dotClass: 'bg-amber-500' };
    case 'connected':
      if (effectiveMuted || micStatus === 'muted') {
        return { label: 'Muted', badgeClass: 'bg-slate-100 text-slate-500', isLive: false, dotClass: 'bg-slate-400' };
      }
      return { label: 'Mic connected', badgeClass: 'bg-blue-50 text-blue-600', isLive: true, dotClass: 'bg-emerald-500' };
    default:
      return { label: 'Disconnected', badgeClass: 'bg-rose-50 text-rose-500', isLive: false, dotClass: 'bg-rose-400' };
  }
}

/* ══════════════════════════════════════════════════════════════
   Avatar — with speaking glow, mute dim, recording indicator,
   and connection dot for local user
   ══════════════════════════════════════════════════════════════ */
function Avatar({ name, recording, speaking, muted, audioLevel = 0, connectionStatus = null }) {
  const glowSize = Math.max(1, Math.round(audioLevel * 4));

  return (
    <div
      className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-[10px] font-black text-white transition-all duration-150 ${
        speaking && !muted
          ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/40'
          : !muted && audioLevel > 0.004
            ? 'ring-2 ring-emerald-300/60 shadow-sm'
            : muted
              ? 'opacity-50 grayscale'
              : ''
      }`}
    >
      {getInitials(name)}

      {/* Speaking glow ring overlay */}
      {speaking && !muted && glowSize > 1 ? (
        <span
          className="absolute inset-0 rounded-full ring-2 ring-emerald-400 animate-pulse"
          style={{
            boxShadow: `0 0 ${glowSize * 3}px ${glowSize}px rgba(52, 211, 153, 0.3)`,
          }}
        />
      ) : null}

      {/* Recording indicator */}
      {recording ? (
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-rose-500" />
      ) : null}

      {/* Muted indicator */}
      {muted && !recording ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-slate-500 dark:border-slate-900 dark:bg-slate-600">
          <FiMicOff className="h-2 w-2 text-white" />
        </span>
      ) : null}

      {/* Connection status dot (local user — shows mic is live on server) */}
      {connectionStatus && !recording && !muted ? (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${connectionStatus.dotClass}`}
          title={connectionStatus.label}
        />
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Utility helpers
   ══════════════════════════════════════════════════════════════ */
function getInitials(name) {
  if (!name) return 'AI';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
