/**
 * Skeleton components — Pulsing placeholders for loading states
 */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 ${className}`}>
      <div className="mb-3 h-3 w-1/3 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="mb-2 h-8 w-1/4 rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-2/3 rounded-full bg-slate-100 dark:bg-slate-700" />
    </div>
  );
}

export function SkeletonRow({ className = '' }) {
  return (
    <div className={`animate-pulse flex items-center gap-3 rounded-lg px-4 py-3 ${className}`}>
      <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-2.5 w-1/3 rounded-full bg-slate-100 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export function SkeletonAvatar({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };
  return (
    <div className={`animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 ${sizes[size] || sizes.md} ${className}`} />
  );
}

export function SkeletonLine({ width = 'full', className = '' }) {
  return (
    <div className={`animate-pulse h-3 rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}
      style={{ width: width === 'full' ? '100%' : width }}
    />
  );
}

export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700 ${className}`} />
  );
}

/**
 * SkeletonPage — Full-page skeleton for view transitions
 */
export function SkeletonPage({ type = 'list' }) {
  if (type === 'grid') {
    return (
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-6">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}
