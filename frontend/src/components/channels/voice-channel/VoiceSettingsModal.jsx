import { useState } from 'react';
import { FiHeadphones, FiMic, FiSettings, FiVolume2, FiZap } from 'react-icons/fi';
import ToggleSwitch from './ToggleSwitch';

export default function VoiceSettingsModal({ settings, onChange, onClose }) {
  const [localSettings, setLocalSettings] = useState({ ...settings });

  const handleToggle = (key) => {
    setLocalSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSensitivity = (e) => {
    setLocalSettings((prev) => ({ ...prev, inputSensitivity: Number(e.target.value) }));
  };

  const handleSave = () => {
    Object.entries(localSettings).forEach(([key, value]) => {
      onChange(key, value);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Voice Quality Settings</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">Configure noise suppression, sensitivity, and more.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-5">
          {/* ─── Noise Suppression ───────────────────────── */}
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-2">
              <FiVolume2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Noise Suppression
            </span>
            <ToggleSwitch
              checked={localSettings.noiseSuppression}
              onChange={() => handleToggle('noiseSuppression')}
            />
          </label>

          {/* ─── Echo Cancellation ───────────────────────── */}
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-2">
              <FiRadio className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Echo Cancellation
            </span>
            <ToggleSwitch
              checked={localSettings.echoCancellation}
              onChange={() => handleToggle('echoCancellation')}
            />
          </label>

          {/* ─── Auto Gain Control ───────────────────────── */}
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-2">
              <FiZap className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Auto Gain Control
            </span>
            <ToggleSwitch
              checked={localSettings.autoGainControl}
              onChange={() => handleToggle('autoGainControl')}
            />
          </label>

          {/* ─── Input Sensitivity ───────────────────────── */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <FiMic className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Input Sensitivity
              </span>
              <span className="rounded-lg bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-black text-slate-600 dark:text-slate-300">
                {localSettings.inputSensitivity}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Low</span>
              <input
                type="range"
                min="1"
                max="80"
                value={localSettings.inputSensitivity}
                onChange={handleSensitivity}
                className="h-1.5 w-full flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700 accent-emerald-500
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-emerald-500/30"
              />
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">High</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
              Lower threshold = more sensitive (detects quieter sounds). Higher threshold = needs louder input to activate.
            </p>
          </div>

          {/* ─── Push to Talk ────────────────────────────── */}
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-2">
              <FiHeadphones className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Push to Talk
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">Hold Space</span>
            </span>
            <ToggleSwitch
              checked={localSettings.pushToTalk}
              onChange={() => handleToggle('pushToTalk')}
            />
          </label>
          {localSettings.pushToTalk && (
            <p className="-mt-3 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
              When enabled, hold the Space key to speak. Mic is muted by default.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}