import { FiCheckCircle, FiLoader } from 'react-icons/fi';

const steps = [
  'Queued',
  'Uploading',
  'Transcribing',
  'Summarizing',
  'Extracting tasks',
  'Ready for review',
];

export default function MeetingProcessingState({ progress = 55, status = 'PROCESSING', onCancel, onRetry }) {
  const activeIndex = Math.min(steps.length - 1, Math.max(0, Math.floor((progress / 100) * steps.length)));

  return (
    <section className="relative border border-slate-300/80 bg-[#edf1f4] p-5 shadow-[0_16px_40px_rgba(71,85,105,0.10)] dark:border-white/10 dark:bg-[#0b1017] dark:shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
      <span className="absolute left-0 top-0 h-px w-20 bg-[#ff6b35]" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border border-[#ff6b35]/35 bg-orange-50 text-[#ff6b35] dark:bg-[#211411]">
          <FiLoader className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">AI is analyzing the meeting</h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Status: {status.toLowerCase()} - {progress}% complete.</p>
        </div>
        </div>
        <div className="flex gap-2">
          {onRetry ? (
            <button type="button" onClick={onRetry} className="border border-slate-300 px-3 py-2 text-xs font-black text-slate-600 hover:border-slate-400 hover:bg-[#e3e9ed] dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 dark:hover:bg-white/[0.05]">
              Retry
            </button>
          ) : null}
          {onCancel ? (
            <button type="button" onClick={onCancel} className="border border-red-300 bg-red-50 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-100 dark:border-red-500/35 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/45">
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden bg-slate-300 dark:bg-white/10">
        <div className="h-full bg-[#ff5824] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-6">
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
          <div key={step} className={`border p-3 text-center ${done || active ? 'border-[#ff6b35]/35 bg-orange-50 dark:bg-[#181313]' : 'border-slate-300 bg-[#e3e9ed] dark:border-white/10 dark:bg-white/[0.02]'}`}>
            <div className={`mx-auto mb-2 flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : active ? 'bg-[#ff5824] text-white' : 'bg-slate-300 text-slate-500 dark:bg-white/10'}`}>
              {done ? <FiCheckCircle className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </div>
            <p className={`text-xs font-black ${done || active ? 'text-orange-700 dark:text-[#ffb38e]' : 'text-slate-500'}`}>{step}</p>
          </div>
          );
        })}
      </div>
      <div className="mt-6 space-y-3">
        <SkeletonLine />
        <SkeletonLine width="w-10/12" />
        <SkeletonLine width="w-8/12" />
      </div>
    </section>
  );
}

function SkeletonLine({ width = 'w-full' }) {
  return <div className={`h-2 ${width} animate-pulse bg-slate-300 dark:bg-white/10`} />;
}
