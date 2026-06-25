'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiHeadphones, FiMic, FiVolume2, FiX, FiZap } from 'react-icons/fi';
import useVoiceActivity from '@/hooks/useVoiceActivity';
import useVoiceDevices from '@/hooks/useVoiceDevices';
import { VOICE_AUDIO_CONFIG, VOICE_NOISE_SUPPRESSION_MODES } from '@/config/voiceAudioConfig';
import MicrophoneTestPanel from './MicrophoneTestPanel';

const PRESETS = [
  { key: 'low', label: 'Low sensitivity', values: { inputSensitivity: 0.05, micBoost: 1.2, softVoiceMode: false } },
  { key: 'normal', label: 'Normal', values: { inputSensitivity: 0.025, micBoost: 2, softVoiceMode: false } },
  { key: 'high', label: 'High sensitivity', values: { inputSensitivity: 0.018, micBoost: 2.5, softVoiceMode: false } },
  { key: 'soft', label: 'Soft voice mode', values: { inputSensitivity: 0.015, micBoost: 3.5, softVoiceMode: true, autoGainControl: true, noiseSuppression: true, inputVolume: 100 } },
];

function audioConstraints(settings) {
  const selectedMicId = settings.selectedMicId ?? settings.inputDeviceId;
  const audio = {
    deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
    echoCancellation: settings.echoCancellation ?? true,
    noiseSuppression: settings.noiseSuppression ?? true,
    autoGainControl: settings.autoGainControl ?? true,
    channelCount: { ideal: VOICE_AUDIO_CONFIG.channelCount },
    sampleRate: { ideal: VOICE_AUDIO_CONFIG.sampleRate },
    sampleSize: { ideal: VOICE_AUDIO_CONFIG.sampleSize },
    latency: { ideal: VOICE_AUDIO_CONFIG.latency },
  };
  if (!audio.deviceId) delete audio.deviceId;
  return { audio, video: false };
}

export default function VoiceSettingsPanel({ settings, onChange, onClose }) {
  const { audioInputs, audioOutputs, error, refreshDevices, supportsOutputDevice } = useVoiceDevices();
  const [testStream, setTestStream] = useState(null);
  const [testError, setTestError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState('');
  const testStreamRef = useRef(null);
  const rawSamplesRef = useRef([]);
  const { isSpeaking, audioLevel, rawRms } = useVoiceActivity(testStream, {
    enabled: !!testStream,
    isMuted: false,
    settings,
    speakingDelayMs: 100,
    silenceDelayMs: 250,
  });

  useEffect(() => {
    if (isCalibrating) rawSamplesRef.current.push(rawRms);
  }, [isCalibrating, rawRms]);

  const selectedMicId = settings.selectedMicId ?? settings.inputDeviceId ?? '';
  const selectedMicLabel = useMemo(() => {
    const device = audioInputs.find((item) => item.deviceId === selectedMicId);
    return device?.label || (selectedMicId ? 'Selected microphone' : 'Default microphone');
  }, [audioInputs, selectedMicId]);

  const stopTest = useCallback(() => {
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((track) => track.stop());
      testStreamRef.current = null;
    }
    setTestStream(null);
    setIsTesting(false);
    setIsCalibrating(false);
  }, []);

  useEffect(() => stopTest, [stopTest]);

  const startTest = useCallback(async () => {
    stopTest();
    setIsTesting(true);
    setTestError('');
    setCalibrationMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints(settings));
      testStreamRef.current = stream;
      setTestStream(stream);
      await refreshDevices();
    } catch (err) {
      const selectedMicId = settings.selectedMicId ?? settings.inputDeviceId;
      if (selectedMicId) {
        try {
          const fallback = await navigator.mediaDevices.getUserMedia(audioConstraints({ ...settings, selectedMicId: null, inputDeviceId: '' }));
          onChange('selectedMicId', null);
          testStreamRef.current = fallback;
          setTestStream(fallback);
          setTestError('Selected microphone unavailable, using default microphone.');
          await refreshDevices();
          return;
        } catch {
          // Show the original error below.
        }
      }
      const blocked = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      setTestError(blocked
        ? 'Browser blocked microphone access. Allow microphone access from the address bar.'
        : 'No microphone is available or the selected microphone could not be opened.');
      setIsTesting(false);
    }
  }, [onChange, refreshDevices, settings, stopTest]);

  const calibrateNoise = useCallback(async () => {
    if (!testStreamRef.current) await startTest();
    rawSamplesRef.current = [];
    setIsCalibrating(true);
    setCalibrationMessage('Stay quiet for 2 seconds...');
    window.setTimeout(() => {
      const samples = rawSamplesRef.current.filter((sample) => Number.isFinite(sample));
      const average = samples.length ? samples.reduce((sum, sample) => sum + sample, 0) / samples.length : 0.005;
      const nextNoiseFloor = Math.max(0.003, Math.min(0.04, average * 1.5));
      onChange('noiseFloor', Number(nextNoiseFloor.toFixed(4)));
      setIsCalibrating(false);
      setCalibrationMessage(`Background noise calibrated at ${nextNoiseFloor.toFixed(4)}.`);
    }, 2000);
  }, [onChange, startTest]);

  const applyPreset = (preset) => {
    Object.entries(preset.values).forEach(([key, value]) => onChange(key, value));
  };

  const toggleSoftVoiceMode = () => {
    if (settings.softVoiceMode) {
      onChange('softVoiceMode', false);
      return;
    }
    applyPreset(PRESETS[3]);
  };

  const micLevelWarning = testStream && audioLevel > 0.02
    ? audioLevel > 0.85
      ? 'Your mic input is very loud and may distort. Lower input volume or microphone boost.'
      : audioLevel < 0.06
        ? 'Your mic input is very quiet. Increase Microphone Boost or enable Soft Voice Mode.'
        : ''
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Voice input settings</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">Microphone, input volume, sensitivity, processing, and live test.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {(error || testError) ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">
              {testError || error}
            </div>
          ) : null}

          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Input device
            <select
              value={selectedMicId}
              onChange={(event) => onChange('selectedMicId', event.target.value || null)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold normal-case text-slate-700 dark:text-slate-200"
            >
              <option value="">Default microphone</option>
              {audioInputs.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Presets</span>
            <div className="grid gap-2 sm:grid-cols-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-slate-400 dark:text-slate-500">
              Soft voice mode is for quiet speakers, laptop mics, or microphones far from your mouth. If background noise triggers speaking, increase sensitivity threshold or run noise calibration.
            </p>
          </div>

          <MicrophoneTestPanel
            audioInputs={audioInputs}
            audioLevel={audioLevel}
            calibrationMessage={calibrationMessage}
            isCalibrating={isCalibrating}
            isSpeaking={isSpeaking}
            isTesting={isTesting}
            micLevelWarning={micLevelWarning}
            onCalibrateNoise={calibrateNoise}
            onRefreshDevices={refreshDevices}
            onStartTest={startTest}
            onStopTest={stopTest}
            selectedMicLabel={selectedMicLabel}
            testError={testError}
            testStream={testStream}
          />

          <Slider label="Input volume" value={settings.inputVolume ?? 100} min={0} max={100} suffix="%" onChange={(value) => onChange('inputVolume', value)} />
          <Slider label="Microphone boost" value={settings.micBoost ?? 2} min={1} max={4} step={0.1} suffix="x" onChange={(value) => onChange('micBoost', value)} />
          <Slider label="Live mic gain" value={settings.micGain ?? VOICE_AUDIO_CONFIG.micGain} min={1} max={2} step={0.05} suffix="x" onChange={(value) => onChange('micGain', value)} />
          <Slider label="Input sensitivity" value={settings.inputSensitivity ?? 0.025} min={0.005} max={0.08} step={0.001} onChange={(value) => onChange('inputSensitivity', value)} />
          <p className="-mt-2 text-[11px] leading-5 text-slate-400 dark:text-slate-500">Lower value = more sensitive. Higher value = less sensitive.</p>

          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Noise suppression mode
            <select
              value={settings.noiseSuppressionMode || VOICE_AUDIO_CONFIG.noiseSuppressionMode}
              onChange={(event) => onChange('noiseSuppressionMode', event.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold normal-case text-slate-700 dark:text-slate-200"
            >
              {VOICE_NOISE_SUPPRESSION_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <Slider label="Noise gate threshold" value={settings.noiseGateThreshold ?? VOICE_AUDIO_CONFIG.noiseGateThreshold} min={0.004} max={0.04} step={0.001} onChange={(value) => onChange('noiseGateThreshold', value)} />
          <Slider label="Noise gate reduction" value={settings.noiseGateReduction ?? VOICE_AUDIO_CONFIG.noiseGateReduction} min={0.15} max={0.85} step={0.05} suffix="x" onChange={(value) => onChange('noiseGateReduction', value)} />

          <ToggleRow icon={<FiMic />} label="Soft voice mode" checked={settings.softVoiceMode} onChange={toggleSoftVoiceMode} />
          <ToggleRow icon={<FiVolume2 />} label="Noise suppression" checked={settings.noiseSuppression} onChange={() => onChange('noiseSuppression', !settings.noiseSuppression)} />
          <ToggleRow icon={<FiHeadphones />} label="Echo cancellation" checked={settings.echoCancellation} onChange={() => onChange('echoCancellation', !settings.echoCancellation)} />
          <ToggleRow icon={<FiZap />} label="Auto gain control" checked={settings.autoGainControl} onChange={() => onChange('autoGainControl', !settings.autoGainControl)} />
          <ToggleRow icon={<FiMic />} label="Push to talk" hint="Hold Space" checked={settings.pushToTalk} onChange={() => onChange('pushToTalk', !settings.pushToTalk)} />

          {supportsOutputDevice ? (
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Speaker
              <select
                value={settings.outputDeviceId || ''}
                onChange={(event) => onChange('outputDeviceId', event.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold normal-case text-slate-700 dark:text-slate-200"
              >
                <option value="">Default speaker</option>
                {audioOutputs.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Speaker ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <Slider label="Output volume" value={Math.round((settings.outputVolume ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(value) => onChange('outputVolume', value / 100)} />
          <Slider label="Local recording gain" value={Math.round((settings.localRecordingGain ?? VOICE_AUDIO_CONFIG.recordingLocalGain) * 100)} min={50} max={180} suffix="%" onChange={(value) => onChange('localRecordingGain', value / 100)} />
          <Slider label="Remote recording gain" value={Math.round((settings.remoteRecordingGain ?? VOICE_AUDIO_CONFIG.recordingRemoteGain) * 100)} min={50} max={180} suffix="%" onChange={(value) => onChange('remoteRecordingGain', value / 100)} />
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
        <span className="rounded-lg bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700 accent-emerald-500"
      />
    </div>
  );
}

function ToggleRow({ icon, label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
      <span className="flex items-center gap-2">
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        {label}
        {hint ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">{hint}</span> : null}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={onChange} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-100 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}
