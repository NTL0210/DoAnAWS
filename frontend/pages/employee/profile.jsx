import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiLoader,
  FiMail,
  FiSave,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import AppShell, { Panel, StatCard, LoadingState } from '../../src/components/layout/AppShell';

const departmentNames = {
  'dept-1': 'Frontend Team',
  'dept-2': 'Backend Team',
  'dept-3': 'AI Team',
  'dept-4': 'DevOps Team',
};

export default function EmployeeProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = {
        id: 'emp-3',
        name: 'John Doe',
        email: 'john@company.com',
        role: 'EMPLOYEE',
        departmentId: 'dept-1',
        avatar: 'https://i.pravatar.cc/150?img=3',
        createdAt: '2026-01-15',
      };
      const currentUser = storedUser?.role === 'EMPLOYEE' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 250));
      setUser(currentUser);
      setDisplayName(currentUser.name);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = () => {
    if (!displayName.trim()) return;
    const updated = { ...user, name: displayName.trim() };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !user) return <LoadingState label="Loading profile..." />;

  return (
    <AppShell
      user={user}
      eyebrow="My profile"
      title="Personal settings"
      description="View and manage your account information."
    >
      <div className="grid gap-6 xl:grid-cols-[0.6fr_1.4fr]">
        {/* Avatar card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-6 text-center shadow-sm dark:border-slate-800 dark:bg-[#17212c]"
        >
          <div className="relative mx-auto inline-block">
            <img
              src={user.avatar}
              alt={user.name}
              className="h-28 w-28 rounded-2xl border-4 border-slate-200 object-cover shadow-md dark:border-slate-700"
            />
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <FiEdit2 className="h-4 w-4" />
            </button>
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            {user.name}
          </h2>
          <p className="text-sm text-slate-500">
            {user.role === 'ADMIN' ? 'Admin' : user.role === 'MANAGER' ? 'Manager' : 'Employee'}
          </p>
          <div className="mt-5 flex justify-center gap-1 text-xs text-slate-400">
            <FiCalendar className="h-3.5 w-3.5" />
            Joined {new Date(user.createdAt || '2026-01-15').toLocaleDateString()}
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="space-y-5"
        >
          <Panel title="Account details" description="Basic information about your account.">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Display name
                </label>
                {editing ? (
                  <div className="flex gap-2">
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      placeholder="Your name"
                    />
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700 active:scale-95"
                    >
                      <FiSave className="h-4 w-4" />
                      Save
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {user.name}
                  </p>
                )}
                {saved && (
                  <p className="mt-1 text-xs font-semibold text-emerald-600">
                    <FiCheckCircle className="mr-1 inline h-3 w-3" />
                    Name saved successfully.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <FiMail className="h-4 w-4 text-slate-400" />
                  {user.email}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Department
                </label>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <FiUsers className="h-4 w-4 text-slate-400" />
                  {departmentNames[user.departmentId] || 'Company'}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Role
                </label>
                <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 ring-1 ring-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:ring-primary-800">
                  <FiUser className="mr-1 h-3 w-3" />
                  {user.role}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Account status" description="Current status and activity summary.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-4 text-center dark:bg-emerald-950/30">
                <FiCheckCircle className="mx-auto h-5 w-5 text-emerald-600" />
                <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">Active</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Status</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-950/30">
                <FiUsers className="mx-auto h-5 w-5 text-blue-600" />
                <p className="mt-2 text-lg font-bold text-blue-700 dark:text-blue-300">{user.departmentId ? 'Team' : '—'}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Department</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-950/30">
                <FiClock className="mx-auto h-5 w-5 text-amber-600" />
                <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-300">
                  {new Date(user.createdAt || '2026-01-15').toLocaleDateString().slice(0, 5)}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Joined</p>
              </div>
            </div>
          </Panel>
        </motion.div>
      </div>
    </AppShell>
  );
}
