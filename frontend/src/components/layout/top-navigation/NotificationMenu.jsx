import { FiBell } from 'react-icons/fi';

export default function NotificationMenu({
  dropdownRef,
  showNotifications,
  setShowNotifications,
  notificationCount,
  markAllNotificationsRead,
}) {
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setShowNotifications(!showNotifications);
          if (!showNotifications) markAllNotificationsRead?.();
        }}
        className={`top-nav-btn ${showNotifications ? 'active' : ''}`}
        title="Notifications"
      >
        <FiBell className="h-4 w-4" />
      </button>
      {notificationCount > 0 && (
        <span className="discord-badge absolute -right-0.5 -top-0.5">{notificationCount}</span>
      )}

      {showNotifications && (
        <div className="dashboard-panel workspace-cut-corner absolute right-0 top-11 z-50 w-80 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-black text-slate-900 dark:text-slate-100">Notifications</span>
            <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-black uppercase text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">Live</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="px-5 py-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300">
                <FiBell className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">All caught up</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New workspace activity will appear here.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
