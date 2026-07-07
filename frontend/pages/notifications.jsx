import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiUserPlus,
  FiX,
} from 'react-icons/fi';
import AppShell, { Panel, LoadingState, EmptyState } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';
import { isCloudMode } from '../src/services/apiClient';

const typeConfig = {
  task_assigned: { icon: FiUserPlus, color: 'bg-blue-50 text-blue-600' },
  deadline_approaching: { icon: FiClock, color: 'bg-amber-50 text-amber-600' },
  meeting_processed: { icon: FiFileText, color: 'bg-primary-50 text-primary-600' },
  task_completed: { icon: FiCheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  comment: { icon: FiBell, color: 'bg-slate-50 text-slate-600' },
  INFO: { icon: FiBell, color: 'bg-slate-50 text-slate-600' },
  INVITATION: { icon: FiUserPlus, color: 'bg-blue-50 text-blue-600' },
};

export default function EmployeeNotifications() {
  const {
    currentUser,
    loading: authLoading,
    aiNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    userInvitations,
    acceptInvitation,
    declineInvitation,
  } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      try {
        if (isCloudMode()) {
          const { notificationsApi } = await import('../src/services/cloudClient');
          const result = await notificationsApi.list();
          const data = result.notifications || result.items || result || [];
          if (!cancelled) setNotifications(Array.isArray(data) ? data : []);
          return;
        }

        if (!cancelled) setNotifications(aiNotifications || []);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!authLoading) loadNotifications();
    return () => { cancelled = true; };
  }, [authLoading, aiNotifications]);

  useEffect(() => {
    if (!isCloudMode()) setNotifications(aiNotifications || []);
  }, [aiNotifications]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    markAllNotificationsRead();
  };

  const toggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
    markNotificationRead(id);
  };

  const handleAcceptInvitation = useCallback(async (invitationId) => {
    await acceptInvitation(invitationId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === invitationId
          ? { ...n, isRead: true, metadata: { ...(n.metadata || {}), status: 'ACCEPTED' } }
          : n
      )
    );
  }, [acceptInvitation]);

  const handleDeclineInvitation = useCallback(async (invitationId) => {
    await declineInvitation(invitationId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === invitationId
          ? { ...n, isRead: true, metadata: { ...(n.metadata || {}), status: 'DECLINED' } }
          : n
      )
    );
  }, [declineInvitation]);

  const pendingInvitationIds = useMemo(
    () => new Set((userInvitations || []).map((invitation) => invitation.id)),
    [userInvitations]
  );
  const notificationItems = useMemo(
    () => notifications
      .filter((notification) => !pendingInvitationIds.has(notification.id))
      .map((notification) => ({ kind: 'notification', id: notification.id, notification })),
    [notifications, pendingInvitationIds]
  );
  const inviteItems = useMemo(
    () => (userInvitations || []).map((invitation) => ({ kind: 'invitation', id: invitation.id, invitation })),
    [userInvitations]
  );
  const allItems = useMemo(
    () => [...inviteItems, ...notificationItems],
    [inviteItems, notificationItems]
  );
  const filtered =
    filter === 'all'
      ? allItems
      : filter === 'unread'
        ? allItems.filter((item) => item.kind === 'invitation' || !item.notification.isRead)
        : allItems;

  const unreadCount =
    inviteItems.length + notificationItems.filter((item) => !item.notification.isRead).length;

  if (loading || authLoading) return <LoadingState label="Loading notifications..." />;
  if (!currentUser) return <LoadingState label="Please log in first." />;

  return (
    <AppShell
      user={currentUser}
      eyebrow="Notifications"
      title="Activity & alerts"
      description={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
      actions={
        unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-[#fbfcfe] px-4 text-sm font-bold text-slate-700 transition hover:bg-white hover:shadow-sm active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FiCheckCircle className="h-4 w-4" />
            Mark all read
          </button>
        )
      }
    >
      <Panel title={`Notifications (${filtered.length})`} description="Stay updated on tasks, meetings, and activity">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: allItems.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                filter === f.key
                  ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={FiBell}
            title="All caught up!"
            description="No notifications match your filter."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((item, idx) => {
              if (item.kind === 'invitation') {
                const invitation = item.invitation;
                return (
                  <motion.div
                    key={invitation.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex w-full items-start gap-4 rounded-lg border border-blue-200/80 bg-blue-50/70 p-4 text-left dark:border-blue-900/60 dark:bg-blue-950/20"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                      <FiUserPlus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Invitation to {invitation.workspaceName || 'Workspace'}
                        </h3>
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {invitation.invitedByUserName || 'A teammate'} invited you to join as {formatRoleLabel(invitation.role)}.
                      </p>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {invitation.createdAt ? new Date(invitation.createdAt).toLocaleString() : ''}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"
                        >
                          <FiCheck className="h-4 w-4" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineInvitation(invitation.id)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-[#fbfcfe] px-4 text-sm font-bold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <FiX className="h-4 w-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              const n = item.notification;
              const config = typeConfig[n.type] || typeConfig.INFO;
              return (
                <motion.button
                  key={n.id}
                  type="button"
                  onClick={() => toggleRead(n.id)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`flex w-full items-start gap-4 rounded-lg border border-slate-200/80 p-4 text-left transition hover:border-primary-200 hover:shadow-sm ${
                    !n.isRead
                      ? 'bg-primary-50/40 dark:bg-primary-900/10'
                      : 'bg-[#fbfcfe] dark:bg-[#17212c]'
                  }`}
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${config.color}`}>
                    <config.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {n.title || n.message || 'Notification'}
                      </h3>
                      {!n.isRead && (
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                      )}
                    </div>
                    {n.message && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.message}</p>}
                    <p className="mt-1.5 text-xs text-slate-400">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function formatRoleLabel(role) {
  const normalized = String(role || 'EMPLOYEE').replace(/_/g, ' ').toLowerCase();
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}
