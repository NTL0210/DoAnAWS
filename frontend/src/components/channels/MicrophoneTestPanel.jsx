'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiMic, FiMicOff, FiRefreshCw, FiVolume2 } from 'react-icons/fi';
import AudioLevelMeter from './AudioLevelMeter';

export default function MicrophoneTestPanel({
  audioInputs = [],
  audioLevel = 0,
  calibrationMessage = '',
  isCalibrating = false,
  isSpeaking = false,
  isTesting = false,
  micLevelWarning = '',
  onCalibrateNoise,
  onRefreshDevices,
  onStartTest,
  onStopTest,
  selectedMicLabel = 'Default microphone',
  testError = '',
  testStream = null,
}) {
  const [zeroLevelSince, setZeroLevelSince] = useState(null);
  const [zeroLevelTimedOut, setZeroLevelTimedOut] = useState(false);

  const track = testStream?.getAudioTracks?.()[0] || null;
  const trackStatus = track?.readyState || (testStream ? 'no-track' : 'not-started');
  const permissionStatus = testError
    ? 'Blocked or unavailable'
    : testStream
      ? 'Granted'
      : 'Not requested';

  const micStatus = useMemo(() => {
    if (!audioInputs.length) return 'No microphone detected';
    if (!testStream) return 'Test microphone';
    if (!track) return 'No microphone detected';
    if (track.readyState === 'ended') return 'Track ended';
    if (!track.enabled) return 'Muted';
    if (isSpeaking) return 'Speaking detected';
    if (audioLevel > 0.01) return 'Listening...';
    return 'Microphone live';
  }, [audioInputs.length, audioLevel, isSpeaking, testStream, track]);

  useEffect(() => {
    if (!testStream) {
      setZeroLevelSince(null);
      setZeroLevelTimedOut(false);
      return;
    }
    if (audioLevel > 0.005) {
      setZeroLevelSince(null);
      setZeroLevelTimedOut(false);
      return;
    }
    setZeroLevelSince((previous) => previous ?? Date.now());
  }, [audioLevel, testStream]);

  useEffect(() => {
    if (!zeroLevelSince) return undefined;
    const timer = window.setTimeout(() => setZeroLevelTimedOut(true), 2500);
    return () => window.clearTimeout(timer);
  }, [zeroLevelSince]);

  const zeroLevelWarning = zeroLevelTimedOut
    ? 'Mic is live but no input level detected. Try increasing Microphone Boost, enabling Soft Voice Mode, or selecting another input device.'
    : '';
  const warning = testError || calibrationMessage || micLevelWarning || zeroLevelWarning;

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FiMic className="h-4 w-4 text-slate-400" />
          <AudioLevelMeter level={audioLevel} speaking={isSpeaking} />
          <span className="text-xs font-black text-slate-500">{Math.round(audioLevel * 100)}%</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{micStatus}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefreshDevices} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
            <FiRefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button type="button" disabled={isCalibrating || !audioInputs.length} onClick={onCalibrateNoise} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <FiVolume2 className="h-3.5 w-3.5" /> {isCalibrating ? 'Calibrating...' : 'Calibrate background noise'}
          </button>
          {testStream ? (
            <button type="button" onClick={onStopTest} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">
              <FiMicOff className="h-3.5 w-3.5" /> Stop test
            </button>
          ) : (
            <button type="button" disabled={isTesting || !audioInputs.length} onClick={onStartTest} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
              <FiMic className="h-3.5 w-3.5" /> {isTesting ? 'Testing...' : 'Test mic'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-1 text-[11px] font-semibold text-slate-400 sm:grid-cols-3">
        <span>Selected: {selectedMicLabel}</span>
        <span>Permission: {permissionStatus}</span>
        <span>Track: {trackStatus}</span>
      </div>

      {warning ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">
          {warning}
        </div>
      ) : null}
    </div>
  );
}
