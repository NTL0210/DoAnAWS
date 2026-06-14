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
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-[#1f2022] bg-[#313338] shadow-xl">
          <div className="border-b border-[#1f2022] px-4 py-3 text-sm font-semibold text-[#dbdee1]">
            Notifications
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="flex items-center justify-center py-8 text-sm text-[#6d6f78]">
              No new notifications
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
