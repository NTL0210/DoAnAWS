import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import {
  FiCalendar,
  FiCamera,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiLock,
  FiMail,
  FiPhone,
  FiSave,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import AppShell, { Panel } from '../src/components/layout/AppShell';
import { useWorkspace } from '../src/context/WorkspaceContext';

const PRESET_COLORS = ['5865F2', 'ED4245', '57F287', 'FEE75C', 'EB459E', 'FF73FA', '00B0FF', '9B59B6'];

const departmentNames = {
  'dept-1': 'Frontend Team',
  'dept-2': 'Backend Team',
  'dept-3': 'AI Team',
  'dept-4': 'DevOps Team',
};

function buildPresetAvatars(name) {
  const encoded = encodeURIComponent(name || 'User');
  return PRESET_COLORS.map((color) => ({
    url: `https://ui-avatars.com/api/?name=${encoded}&background=${color}&color=fff&size=128&bold=true`,
    color,
  }));
}

export default function AccountSettings() {
  const router = useRouter();
  const { currentUser, updateCurrentUser, showToast, workspaces } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');

  // Avatar state
  const [avatar, setAvatar] = useState(null);
  const [avatarHistory, setAvatarHistory] = useState([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  const user = currentUser;

  useEffect(() => {
    if (!user) {
      // Wait briefly for context to hydrate
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }
    setDisplayName(user.name || '');
    setPhone(user.phone || '');
    setAvatar(user.avatar || null);
    setAvatarHistory(user.avatarHistory || []);
    setLoading(false);
  }, [user]);

  // Resolve user workspace
  const myWorkspace = useMemo(() => {
    if (!user) return null;
    return workspaces.find((ws) =>
      ws.members?.some((m) => m.userId === user.id)
    ) || null;
  }, [workspaces, user]);

  const workspaceName = myWorkspace?.name || '—';
  const departmentName = departmentNames[user?.departmentId] || workspaceName;

  // Save display name & phone
  const handleSave = async () => {
    if (!displayName.trim()) {
      showToast('error', 'Display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      updateCurrentUser({
        name: displayName.trim(),
        phone: phone.trim(),
      });
      setSaved(true);
      showToast('success', 'Account settings saved successfully.');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      showToast('error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Avatar management
  const handleSelectAvatar = (newUrl) => {
    if (newUrl === avatar) {
      setShowAvatarPicker(false);
      return;
    }

    let newHistory = [...avatarHistory];
    if (avatar) {
      newHistory = [avatar, ...newHistory.filter((a) => a !== newUrl)];
      if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);
    }

    setAvatar(newUrl);
    setAvatarHistory(newHistory);
    setShowAvatarPicker(false);
    setCustomAvatarUrl('');

    updateCurrentUser({ avatar: newUrl, avatarHistory: newHistory });
    showToast('success', 'Avatar updated.');
  };

  const handleRestoreHistoryAvatar = (oldUrl) => {
    if (oldUrl === avatar) return;

    let newHistory = avatarHistory.filter((a) => a !== oldUrl);
    if (avatar) newHistory.unshift(avatar);
    if (newHistory.length > 5) newHistory.length = 5;

    setAvatar(oldUrl);
    setAvatarHistory(newHistory);
    updateCurrentUser({ avatar: oldUrl, avatarHistory: newHistory });
    showToast('success', 'Restored previous avatar.');
  };

  const handleCustomAvatarSubmit = () => {
    const url = customAvatarUrl.trim();
    if (!url) return;
    try {
      new URL(url);
      handleSelectAvatar(url);
    } catch {
      showToast('error', 'Please enter a valid URL.');
    }
  };

  // Guard: not logged in
  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="text-center">
          <FiLock className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-4 text-sm font-medium text-slate-500">Please log in first.</p>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-slate-950">
        <div className="text-center">
          <FiLoader className="mx-auto h-8 w-8 animate-spin text-primary-600" />
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading account settings...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      eyebrow="Account"
      title="Account settings"
      description="View and manage your personal account information."
    >
      <div className="grid gap-6 xl:grid-cols-[0.55fr_1.45fr]">
        {/* LEFT COLUMN: Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-6 text-center shadow-sm">
            <div className="relative mx-auto inline-block">
              {avatar ? (
                <img
                  src={avatar}
                  alt={user.name}
                  className="h-28 w-28 rounded-2xl border-4 border-slate-200 object-cover shadow-md dark:border-slate-600"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-slate-200 bg-[#5865F2] text-4xl font-black text-white shadow-md dark:border-slate-600">
                  {(user.name || user.email || 'U').slice(0, 2).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Change avatar"
              >
                <FiCamera className="h-4 w-4" />
              </button>
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
              {user.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user.role === 'ADMIN' ? 'Admin' : user.role === 'MANAGER' ? 'Manager' : 'Employee'}
            </p>
            {user.createdAt && (
              <div className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <FiCalendar className="h-3.5 w-3.5" />
                Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>

          {avatarHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Previous avatars ({avatarHistory.length}/5)
              </p>
              <div className="grid grid-cols-5 gap-2">
                {avatarHistory.map((oldUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleRestoreHistoryAvatar(oldUrl)}
                    className="group relative overflow-hidden rounded-lg border-2 border-transparent transition hover:border-blue-400 active:scale-95"
                    title="Click to restore this avatar"
                  >
                    <img
                      src={oldUrl}
                      alt={`Previous avatar ${idx + 1}`}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition group-hover:bg-black/30">
                      <FiCheckCircle className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* RIGHT COLUMN: Details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="space-y-5"
        >
          <Panel title="Account details" description="Basic information about your account.">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Display name
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-primary-900/30"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Email
                </label>
                <p className="inline-flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 w-full">
                  <FiMail className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  <span className="flex-1">{user.email}</span>
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Phone <span className="font-normal lowercase text-slate-400 dark:text-slate-500">(optional)</span>
                </label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-primary-900/30"
                    placeholder="+84 123 456 789"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Role
                </label>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3.5 py-1.5 text-xs font-bold text-primary-700 ring-1 ring-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:ring-primary-800">
                  <FiUser className="h-3 w-3" />
                  {user.role}
                </span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Department
                </label>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <FiUsers className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {departmentName}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Joined
                </label>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <FiClock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-bold text-white transition hover:bg-primary-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiSave className="h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                {saved && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  >
                    <FiCheckCircle className="h-3.5 w-3.5" />
                    Saved
                  </motion.span>
                )}
              </div>
            </div>
          </Panel>
        </motion.div>
      </div>

      {/* Avatar picker modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-slate-100">Choose avatar</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pick a preset or paste a custom image URL.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarPicker(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Presets</p>
            <div className="mb-4 grid grid-cols-4 gap-2.5">
              {buildPresetAvatars(user.name).map((preset) => {
                const isActive = avatar === preset.url;
                return (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => handleSelectAvatar(preset.url)}
                    className={`relative overflow-hidden rounded-xl border-2 transition hover:opacity-90 active:scale-95 ${
                      isActive
                        ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <img src={preset.url} alt="Avatar preset" className="h-full w-full object-cover" />
                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary-500/20">
                        <FiCheckCircle className="h-5 w-5 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Or use a custom URL</p>
            <div className="flex gap-2">
              <input
                value={customAvatarUrl}
                onChange={(e) => setCustomAvatarUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomAvatarSubmit(); }}
                placeholder="https://example.com/avatar.jpg"
                className="h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-primary-900/30"
              />
              <button
                type="button"
                onClick={handleCustomAvatarSubmit}
                disabled={!customAvatarUrl.trim()}
                className="h-11 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Set
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AppShell>
  );
}
