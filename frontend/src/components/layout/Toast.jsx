import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';
import { useWorkspace } from '@/context/WorkspaceContext';

const ICONS = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  info: FiInfo,
};

const COLORS = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/80 dark:border-emerald-800',
    icon: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-800 dark:text-emerald-200',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
  },
  error: {
    bg: 'bg-red-50 border-red-200 dark:bg-red-900/80 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-800 dark:text-red-200',
    bar: 'bg-red-500 dark:bg-red-400',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/80 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-800 dark:text-blue-200',
    bar: 'bg-blue-500 dark:bg-blue-400',
  },
};

/**
 * ToastContainer — Fixed-position toast notification system
 * Renders all active toasts from WorkspaceContext
 */
export default function ToastContainer() {
  const { toasts, dismissToast } = useWorkspace();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || FiInfo;
          const color = COLORS[toast.type] || COLORS.info;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`pointer-events-auto flex w-80 items-start gap-3 rounded-xl border p-4 shadow-xl shadow-slate-900/10 dark:shadow-black/20 ${color.bg}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${color.icon}`} />
              <p className={`flex-1 text-sm font-semibold ${color.text}`}>{toast.message}</p>
              {toast.actionLabel && toast.onAction ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction();
                    dismissToast(toast.id);
                  }}
                  className={`flex-shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-black transition hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900 ${color.text}`}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className={`flex-shrink-0 rounded-lg p-1 transition hover:bg-white/50 dark:hover:bg-slate-900/50 ${color.text}`}
              >
                <FiX className="h-3.5 w-3.5" />
              </button>
              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: (toast.duration || 3500) / 1000, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 w-full origin-left rounded-full ${color.bar}`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
