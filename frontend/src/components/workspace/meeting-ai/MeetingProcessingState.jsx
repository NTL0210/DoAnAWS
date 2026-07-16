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
    <section className="relative border border-white/10 bg-[#0b1017] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
      <span className="absolute left-0 top-0 h-px w-20 bg-[#ff6b35]" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border border-[#ff6b35]/35 bg-[#211411] text-[#ff6b35]">
          <FiLoader className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">AI is analyzing the meeting</h2>
          <p className="text-sm font-medium text-slate-400">Status: {status.toLowerCase()} - {progress}% complete.</p>
        </div>
        </div>
        <div className="flex gap-2">
          {onRetry ? (
            <button type="button" onClick={onRetry} className="border border-white/15 px-3 py-2 text-xs font-black text-slate-300 hover:border-white/30 hover:bg-white/[0.05]">
              Retry
            </button>
          ) : null}
          {onCancel ? (
            <button type="button" onClick={onCancel} className="border border-red-500/35 bg-red-950/20 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-950/45">
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden bg-white/10">
        <div className="h-full bg-[#ff5824] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-6">
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
          <div key={step} className={`border p-3 text-center ${done || active ? 'border-[#ff6b35]/35 bg-[#181313]' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className={`mx-auto mb-2 flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : active ? 'bg-[#ff5824] text-white' : 'bg-white/10 text-slate-500'}`}>
              {done ? <FiCheckCircle className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </div>
            <p className={`text-xs font-black ${done || active ? 'text-[#ffb38e]' : 'text-slate-500'}`}>{step}</p>
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
  return <div className={`h-2 ${width} animate-pulse bg-white/10`} />;
}
