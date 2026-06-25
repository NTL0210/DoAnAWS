export default function ConfirmModal({
  title,
  message,
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Join Anyway',
  confirmTone = 'primary',
}) {
  const confirmClass = confirmTone === 'danger'
    ? 'rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700'
    : 'rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className={confirmClass}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
