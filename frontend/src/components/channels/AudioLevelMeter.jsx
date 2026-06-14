'use client';

/**
 * AudioLevelMeter — 5-bar animated level indicator.
 *
 * @param {Object} props
 * @param {number} props.level  - Audio level 0-1
 * @param {boolean} props.speaking - Whether speaking is detected
 */
export default function AudioLevelMeter({ level = 0, speaking = false }) {
  const bars = 5;
  const normalized = Math.min(1, Math.max(0, Number(level) || 0));
  const percent = Math.round(normalized * 100);
  const activeBars = normalized > 0.01 ? Math.max(1, Math.ceil(normalized * bars)) : 0;
  const rangeLabel = percent < 20 ? 'quiet' : percent < 60 ? 'good' : 'loud';

  return (
    <div className="flex h-5 items-end gap-[2px]" title={`Audio level ${percent}% (${rangeLabel})`}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-75 ${
            i < activeBars
              ? speaking
                ? 'bg-emerald-500 shadow-sm shadow-emerald-400/70'
                : 'bg-emerald-400'
              : 'bg-slate-200 dark:bg-slate-600'
          }`}
          style={{
            height: `${4 + (i + 1) * 3}px`,
          }}
        />
      ))}
    </div>
  );
}
