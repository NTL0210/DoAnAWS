'use client';

import React from 'react';
/**
 * VoiceControls — pure presentational component for voice channel controls.
 *
 * Props:
 *   joined, onJoin, onLeave
 *   muted, onToggleMute, deafen, onToggleDeafen
 *   isMicEnabled, isSpeaking, isPTTActive
 *   recordingState, onToggleRecording
 *   voiceSettings (object with pushToTalk, deafen, etc.)
 *   showSettings, onOpenSettings
 *   showDebug, onToggleDebug
 *   canManagePermissions
 *   channelName
 *   participantCount
 *   audioLevel (0-1)
 *   isMicActive (has live mic stream)
 */
export default function VoiceControls({
  joined,
  onJoin,
  onLeave,
  muted,
  onToggleMute,
  deafen,
  onToggleDeafen,
  isMicEnabled,
  isSpeaking,
  isPTTActive,
  recordingState,
  onToggleRecording,
  voiceSettings,
  showSettings,
  onOpenSettings,
  showDebug,
  onToggleDebug,
  canManagePermissions,
  channelName,
  participantCount,
  audioLevel,
  isMicActive,
}) {
  const isRecording = recordingState === 'recording' || recordingState === 'starting';

  if (!joined) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Join Voice Channel</h3>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Connect to <strong>{channelName || 'this channel'}</strong> to talk with other members.
        </p>
        <button
          type="button"
          onClick={onJoin}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.97]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          Join Voice
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">

      {/* Active channel header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500">
            <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
          </span>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
            {channelName || 'Voice Channel'}
          </h3>
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {participantCount > 0 ? `${participantCount} here` : 'Alone'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Settings gear */}
          {canManagePermissions && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
              title="Voice channel settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          {/* Debug toggle */}
          <button
            type="button"
            onClick={onToggleDebug}
            className={`rounded-lg p-2 text-xs font-bold transition ${showDebug ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="Debug panel"
          >
            DEV
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mute / Unmute */}
        <button
          type="button"
          onClick={onToggleMute}
          disabled={deafen}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
            muted || deafen
              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300'
          }`}
          title={muted || deafen ? 'Unmute (Ctrl+Shift+M)' : 'Mute (Ctrl+Shift+M)'}
        >
          {muted || deafen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5l-4.72 4.72a.75.75 0 00-.53.22L3.22 10.03a.75.75 0 000 1.06l2.83 2.83a.75.75 0 001.06 0l3.53-3.53M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          )}
          {muted || deafen ? 'Muted' : 'Unmuted'}
        </button>

        {/* Deafen / Undeafen */}
        <button
          type="button"
          onClick={onToggleDeafen}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition active:scale-[0.97] ${
            deafen
              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
          title={deafen ? 'Undeafen (Ctrl+Shift+D)' : 'Deafen (Ctrl+Shift+D)'}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          {deafen ? 'Deafened' : 'Deafen'}
        </button>

        {/* Leave */}
        <button
          type="button"
          onClick={onLeave}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.97]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Leave
        </button>
      </div>

      {/* Mic status indicator */}
      {isMicActive && (
        <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
            <span className="text-slate-500 dark:text-slate-400">Microphone</span>
            <span className={muted || deafen ? 'text-rose-500' : 'text-emerald-600'}>
              {muted || deafen ? 'Muted' : 'Active'}
            </span>
          </div>
          {/* Audio level bar */}
          {!muted && !deafen && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  isSpeaking ? 'bg-emerald-500' : 'bg-blue-400'
                }`}
                style={{ width: `${Math.min(100, (audioLevel || 0) * 100)}%` }}
              />
            </div>
          )}
          {voiceSettings.pushToTalk && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Push to Talk</span>
              <span className="text-xs font-bold text-blue-600">
                {isPTTActive ? 'Holding' : 'Off'}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
