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
            className="workspace-command-button is-secondary"
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
              className={`dashboard-pill-button ${filter === f.key ? 'is-active' : ''}`}
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
                    className="dashboard-panel workspace-cut-corner flex w-full items-start gap-4 border-l-4 border-l-orange-500 p-4 text-left"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                      <FiUserPlus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Invitation to {invitation.workspaceName || 'Workspace'}
                        </h3>
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
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
                          className="workspace-command-button is-primary"
                        >
                          <FiCheck className="h-4 w-4" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineInvitation(invitation.id)}
                          className="workspace-command-button is-secondary"
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
                  className={`dashboard-panel workspace-cut-corner flex w-full items-start gap-4 p-4 text-left transition hover:-translate-y-0.5 ${
                    !n.isRead
                      ? 'border-l-4 border-l-orange-500 ring-1 ring-orange-100 dark:ring-orange-950/60'
                      : 'opacity-80 hover:opacity-100'
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
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
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
