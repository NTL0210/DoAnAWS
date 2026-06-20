import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '@/context/WorkspaceContext';
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import {
  FiActivity,
  FiBarChart2,
  FiBell,
  FiChevronDown,
  FiBriefcase,
  FiCheckCircle,
  FiChevronRight,
  FiFileText,
  FiGrid,
  FiHome,
  FiLayers,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiVolume2,
  FiVolumeX,
  FiUploadCloud,
  FiUser,
  FiUsers,
} from 'react-icons/fi';

/* ============================================
   ROLE-BASED NAVIGATION CONFIG
   ============================================ */
const roleMeta = {
  ADMIN: {
    label: 'Admin',
    nav: [
      { label: 'Dashboard', href: '/dashboard', icon: FiGrid, anim: 'float' },
      { label: 'Workspace', href: '/workspace', icon: FiLayers, anim: 'pulse' },
      { label: 'Meetings', href: '/workspace?view=meetings', icon: FiFileText, anim: 'bob' },
      { label: 'Upload', href: '/workspace?view=meetings&tab=upload', icon: FiUploadCloud, anim: 'spin' },
      { label: 'Departments', href: '/departments', icon: FiBriefcase, anim: 'pulse' },
      { label: 'Users', href: '/users', icon: FiUsers, anim: 'bob' },
      { label: 'All Tasks', href: '/workspace?view=tasks', icon: FiCheckCircle, anim: 'float' },
      { label: 'Analytics', href: '/workspace?view=analytics', icon: FiBarChart2, anim: 'pulse' },
      { label: 'Logs', href: '/logs', icon: FiActivity, anim: 'bob' },
      { label: 'Settings', href: '/settings', icon: FiSettings, anim: 'spin' },
    ],
  },
  MANAGER: {
    label: 'Manager',
    nav: [
      { label: 'Dashboard', href: '/dashboard', icon: FiHome, anim: 'float' },
      { label: 'Workspace', href: '/workspace', icon: FiLayers, anim: 'pulse' },
      { label: 'Meetings', href: '/workspace?view=meetings', icon: FiFileText, anim: 'bob' },
      { label: 'Upload', href: '/workspace?view=meetings&tab=upload', icon: FiUploadCloud, anim: 'spin' },
      { label: 'Team Tasks', href: '/workspace?view=tasks', icon: FiCheckCircle, anim: 'float' },
      { label: 'Employees', href: '/employees', icon: FiUsers, anim: 'bob' },
      { label: 'Analytics', href: '/workspace?view=analytics', icon: FiBarChart2, anim: 'pulse' },
    ],
  },
  EMPLOYEE: {
    label: 'Employee',
    nav: [
      { label: 'Dashboard', href: '/dashboard', icon: FiHome, anim: 'float' },
      { label: 'Workspace', href: '/workspace', icon: FiLayers, anim: 'pulse' },
      { label: 'Meetings', href: '/workspace?view=meetings', icon: FiFileText, anim: 'bob' },
      { label: 'My Tasks', href: '/workspace?view=tasks', icon: FiCheckCircle, anim: 'float' },
      { label: 'Notifications', href: '/notifications', icon: FiBell, anim: 'pulse' },
      { label: 'Profile', href: '/profile', icon: FiUser, anim: 'spin' },
    ],
  },
};

const departmentNames = {
  'dept-1': 'Frontend Team',
  'dept-2': 'Backend Team',
  'dept-3': 'AI Team',
  'dept-4': 'DevOps Team',
};

const iconAnimClass = {
  float: 'nav-icon-float',
  spin: 'nav-icon-spin',
  bob: 'nav-icon-bob',
  pulse: 'nav-icon-pulse',
};

/* ============================================
   APP SHELL — MAIN LAYOUT (dark narrow sidebar)
   ============================================ */
export default function AppShell({ user, children, eyebrow, title, description, actions, showWorkspaceSwitcher = true }) {
  const router = useRouter();
  const {
    currentUser,
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    selectWorkspace,
    showCreateWorkspace,
    setShowCreateWorkspace,
    workspaceRole,
    aiNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    workspaceNotificationsEnabled,
    toggleWorkspaceNotifications,
  } = useWorkspace();

  const accessibleWorkspaces = useMemo(() => {
    if (!currentUser) return [];
    return workspaces.filter((workspace) =>
      workspace.members.some((member) => member.userId === currentUser.id)
    );
  }, [currentUser, workspaces]);

  const shellUser = useMemo(() => (
    currentUser ? { ...(user || {}), ...currentUser } : user
  ), [currentUser, user]);

  const effectiveRole = normalizeWorkspaceRole(workspaceRole) || shellUser?.role || 'EMPLOYEE';
  const meta = roleMeta[effectiveRole] || roleMeta.EMPLOYEE;
  const initials = getInitials(shellUser?.name || meta.label);
  const department = departmentNames[shellUser?.departmentId] || 'Company workspace';
  const dashboardHref = getDashboardHref(effectiveRole);
  const profileHref = '/profile';
  const notifications = aiNotifications || [];

  const [notifOpen, setNotifOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const notifCount = notifications.filter((item) => item.unread || item.isRead === false).length;
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef(null);
  const workspaceRef = useRef(null);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (workspaceRef.current && !workspaceRef.current.contains(e.target)) {
        setWorkspaceOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('meetingAppUser');
    localStorage.removeItem('activeWorkspaceId');
    window.location.href = '/login';
  }, []);

  const toggleNotif = useCallback(() => {
    setNotifOpen((v) => !v);
  }, []);

  const handleWorkspaceSelect = useCallback((workspaceId) => {
    if (workspaceId === activeWorkspaceId) {
      setWorkspaceOpen(false);
      return;
    }
    selectWorkspace(workspaceId);
    setWorkspaceOpen(false);
    if (router.pathname !== '/workspace') {
      router.push(getDashboardHref(normalizeWorkspaceRole(
        workspaces
          .find((workspace) => workspace.id === workspaceId)
          ?.members.find((member) => member.userId === currentUser?.id)?.role
      )));
    }
  }, [activeWorkspaceId, currentUser, router, selectWorkspace, workspaces]);

  /** Active check: exact match or sub-route matching */
  const isActive = useCallback(
    (href) => {
      const currentPath = router.asPath.split('#')[0];
      const [hrefPath, hrefQuery] = href.split('?');

      if (hrefQuery) return currentPath === href;
      if (hrefPath === '/workspace') return router.pathname === '/workspace' && !router.query.view;
      if (hrefPath === router.pathname) return true;
      if (hrefPath !== '/' && !hrefPath.includes('?') && router.pathname.startsWith(hrefPath + '/')) return true;
      return false;
    },
    [router.asPath, router.pathname, router.query.view]
  );

  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-50">
      {/* ========== DARK NARROW SIDEBAR ========== */}
      <aside className="app-sidebar-rail fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col items-center border-r border-slate-950 bg-[#111214] py-4 text-slate-400 shadow-2xl lg:flex">
        {/* Brand icon — static (icon web) */}
        <span
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 font-bold shadow-lg shadow-blue-500/20"
          title="AI Meeting Platform"
        >
          <span className="nav-icon-float text-sm">AI</span>
        </span>

        {/* Decorative orbs */}
        <div className="sidebar-orb sidebar-orb-1 !opacity-10" />
        <div className="sidebar-orb sidebar-orb-2 !opacity-10" />

        {/* Navigation — all items are clickable links */}
        <nav className="app-sidebar-nav relative z-10 flex flex-1 flex-col gap-2 px-2 overflow-y-auto overflow-x-hidden">
          {meta.nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={(event) => {
                  if (active) event.preventDefault();
                }}
                className={`nav-item-3d group relative flex h-11 w-11 items-center justify-center rounded-xl transition ${
                  active
                    ? 'is-active bg-white text-slate-700 shadow-xl shadow-black/30 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
                title={item.label}
              >
                {active && <span className="nav-dot-active left-[-6px]" />}
                <item.icon className={`sidebar-icon-symbol h-5 w-5 ${iconAnimClass[item.anim] || 'nav-icon-float'}`} />
                {/* Tooltip */}
                <span className="pointer-events-none absolute left-14 z-40 hidden whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block animate-[slideDown_0.2s_ease-out]">
                  {item.label}
                </span>
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user avatar + logout */}
        <div className="relative z-10 mt-auto flex flex-col items-center gap-3 pt-4 border-t border-white/10 w-full px-3">
          {/* User avatar with tooltip */}
          <div className="group relative">
            <button
              type="button"
              onClick={() => {
                if (router.asPath !== profileHref) router.push(profileHref);
              }}
              className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 transition hover:opacity-80"
              title={shellUser?.name}
            >
              {shellUser?.avatar ? (
                <img src={shellUser.avatar} alt={shellUser.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary-600 text-xs font-bold">
                  {initials}
                </div>
              )}
            </button>
            <span className="pointer-events-none absolute left-12 bottom-0 z-40 hidden whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block animate-[slideDown_0.2s_ease-out]">
              {shellUser?.name || meta.label}
              <span className="block text-[10px] font-normal text-slate-400">{meta.label}</span>
            </span>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-red-300 active:scale-90"
            title="Logout"
          >
            <FiLogOut className="h-4 w-4" />
            <span className="pointer-events-none absolute left-12 z-40 hidden whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block animate-[slideDown_0.2s_ease-out]">
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* ========== MAIN AREA ========== */}
      <div className="lg:pl-[76px]">
        {/* ========== TOPBAR ========== */}
        <header className="topbar-glass sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 dark:bg-slate-950/90 dark:border-slate-800/80">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            {/* Brand */}
            <Link
              href={dashboardHref}
              onClick={(event) => {
                if (router.asPath === dashboardHref) event.preventDefault();
              }}
              className="flex min-w-[240px] items-center gap-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-blue-500 text-xs font-bold text-white">
                AI
              </span>
              <span className="text-xl font-black text-blue-600">
                AI Meeting
              </span>
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400 md:inline-flex">
                {meta.label} in workspace
              </span>
            </Link>

            {showWorkspaceSwitcher ? (
            <div className="relative hidden min-w-[220px] md:block" ref={workspaceRef}>
              <button
                type="button"
                onClick={() => setWorkspaceOpen((value) => !value)}
                className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-400"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-500 text-[10px] font-black text-white">
                    {getInitials(activeWorkspace?.name || 'AI')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-900 dark:text-slate-100">
                      {activeWorkspace?.name || 'Select workspace'}
                    </span>
                    <span className="block truncate text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      {meta.label}
                    </span>
                  </span>
                </span>
                <FiChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500 transition ${workspaceOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {workspaceOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute left-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Switch workspace</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Dashboard and role follow the selected workspace.</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2">
                      {accessibleWorkspaces.length > 0 ? (
                        accessibleWorkspaces.map((workspace) => {
                          const member = workspace.members.find((item) => item.userId === currentUser?.id);
                          const selected = workspace.id === activeWorkspaceId;
                          return (
                            <button
                              key={workspace.id}
                              type="button"
                              onClick={() => handleWorkspaceSelect(workspace.id)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                                selected
                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-900'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                              }`}
                            >
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-black text-white">
                                {getInitials(workspace.name)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black">{workspace.name}</span>
                                <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500">
                                  {normalizeWorkspaceRole(member?.role) || 'Member'}
                                </span>
                              </span>
                              {selected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-xl bg-slate-50 px-4 py-5 text-center dark:bg-slate-800">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No workspace yet</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create or accept an invite to start.</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create or accept an invite to start.</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-100 p-2 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceOpen(false);
                          setShowCreateWorkspace(true);
                        }}
                        className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-blue-700"
                      >
                        <FiPlus className="h-3.5 w-3.5" /> Create Workspace
                      </button>
                      <Link
                        href="/workspace"
                        onClick={() => setWorkspaceOpen(false)}
                        className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white transition hover:bg-slate-800"
                      >
                        Manage workspaces
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            ) : null}

            {/* Search bar */}
            <div
              className={`search-glow hidden max-w-md flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all md:flex ${
                searchFocused
                  ? 'border-primary-300 bg-white dark:border-primary-700 dark:bg-slate-900'
                  : 'border-slate-200 bg-[#eef3f8] dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <FiSearch
                className={`h-4 w-4 transition-colors ${
                  searchFocused ? 'text-primary-500' : 'text-slate-400'
                }`}
              />
              <input
                aria-label="Search"
                placeholder="Search meetings, tasks, people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-[10px] text-white hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-3">
              <AnimatedThemeToggler className="theme-toggler-button border border-slate-200 bg-[#fbfcfe] shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" variant="circle" duration={400} />

              {/* Notification bell */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={toggleNotif}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-lg border text-slate-500 transition hover:bg-white hover:shadow-sm active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 ${
                    notifOpen
                      ? 'border-primary-200 bg-primary-50 text-primary-600 dark:border-primary-900 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'border-slate-200 bg-[#fbfcfe] dark:border-slate-700 dark:bg-slate-900'
                  }`}
                  title="Notifications"
                >
                  <FiBell className="h-4 w-4" />
                  {notifCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg">
                      {notifCount}
                    </span>
                  )}
                </button>

                {/* Notification dropdown */}
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute right-0 top-12 z-40 w-80 rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Notifications
                        </h3>
                        {notifCount > 0 && (
                          <button
                            type="button"
                            onClick={markAllNotificationsRead}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {activeWorkspace?.name || 'Workspace'} chat alerts
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleWorkspaceNotifications(activeWorkspaceId)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition ${
                            workspaceNotificationsEnabled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                          }`}
                        >
                          {workspaceNotificationsEnabled ? <FiVolume2 className="h-3.5 w-3.5" /> : <FiVolumeX className="h-3.5 w-3.5" />}
                          {workspaceNotificationsEnabled ? 'On' : 'Muted'}
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <FiBell className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
                            <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">No notifications yet</p>
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Workspace chat alerts will appear here.</p>
                          </div>
                        ) : notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => markNotificationRead(n.id)}
                            className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                              (n.unread || n.isRead === false) ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <div
                              className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                                (n.unread || n.isRead === false)
                                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              <FiBell className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{n.time || formatNotificationTime(n.createdAt)}</p>
                            </div>
                            {(n.unread || n.isRead === false) && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-slate-200 px-4 py-2.5 dark:border-slate-800">
                        <Link
                          href="/notifications"
                          className="block text-center text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                          onClick={() => setNotifOpen(false)}
                        >
                          View all notifications
                          <FiChevronRight className="ml-1 inline h-3 w-3" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User info (desktop) */}
              <div className="hidden items-center gap-3 sm:flex">
                {shellUser?.avatar ? (
                  <img src={shellUser.avatar} alt={shellUser.name} className="h-9 w-9 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
                    {initials}
                  </div>
                )}
                <div className="hidden md:block">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{shellUser?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{meta.label} &middot; {department}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ========== PAGE CONTENT ========== */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {/* Page header */}
          {(title || description || eyebrow || actions) && (
            <motion.section
              key={title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="mb-6 flex flex-col gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-5 shadow-sm shadow-slate-200/70 sm:flex-row sm:items-end sm:justify-between dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/70"
            >
              <div className="min-w-0">
                {eyebrow && (
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-600 dark:text-primary-400">{eyebrow}</p>
                )}
                {title && (
                  <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-900 sm:text-3xl dark:text-slate-100">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </motion.section>
          )}

          {/* Children (page content) */}
          <motion.div
            key={router.asPath}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      {showCreateWorkspace ? (
        <CreateWorkspaceModal isModal onClose={() => setShowCreateWorkspace(false)} />
      ) : null}
    </div>
  );
}

/* ============================================
   STAT CARD
   ============================================ */
export function StatCard({ label, value, detail, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      className="rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-5 shadow-sm shadow-slate-200/60 transition-shadow hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60 dark:hover:shadow-slate-950/80"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-normal text-slate-900 dark:text-slate-100">{value}</p>
          {detail && <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{detail}</p>}
        </div>
        {Icon && (
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ring-1 ${tones[tone]} float-card`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ============================================
   PANEL
   ============================================ */
export function Panel({ title, description, action, children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border border-slate-200/80 bg-[#fbfcfe] shadow-sm shadow-slate-200/60 dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60 ${className}`}
    >
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div>
            {title && <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

/* ============================================
   STATUS PILL
   ============================================ */
export function StatusPill({ children, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return (
    <span className={`badge-bounce inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ============================================
   LOADING STATE
   ============================================ */
export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

/* ============================================
   EMPTY STATE
   ============================================ */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-[#f4f7fb] p-10 text-center dark:border-slate-700 dark:bg-slate-800">
      {Icon && <Icon className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />}
      <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Get initials from a name string */
function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getDashboardHref(role) {
  return '/dashboard';
}

function normalizeWorkspaceRole(role) {
  if (role === 'OWNER' || role === 'VICE_ADMIN' || role === 'ADMIN') return 'ADMIN';
  if (role === 'MANAGER') return 'MANAGER';
  if (role === 'EMPLOYEE') return 'EMPLOYEE';
  return null;
}

function formatNotificationTime(value) {
  if (!value) return 'Just now';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

