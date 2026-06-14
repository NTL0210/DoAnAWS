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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <FiLoader className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-950">AI is analyzing the meeting</h2>
          <p className="text-sm font-medium text-slate-500">Status: {status.toLowerCase()} - {progress}% complete.</p>
        </div>
        </div>
        <div className="flex gap-2">
          {onRetry ? (
            <button type="button" onClick={onRetry} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
              Retry
            </button>
          ) : null}
          {onCancel ? (
            <button type="button" onClick={onCancel} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-100">
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-6">
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
          <div key={step} className={`rounded-xl border p-3 text-center ${done || active ? 'border-blue-100 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
            <div className={`mx-auto mb-2 flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
              {done ? <FiCheckCircle className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </div>
            <p className={`text-xs font-black ${done || active ? 'text-blue-700' : 'text-slate-400'}`}>{step}</p>
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
  return <div className={`h-3 ${width} animate-pulse rounded-full bg-slate-200`} />;
}
