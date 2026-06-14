import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiLoader, FiMail, FiShield, FiUser, FiUserCheck, FiUserX, FiUsers } from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../../src/components/layout/AppShell';
import { getUsers } from '../../src/services/legacyDataService';

const departmentNames = {
  'dept-1': 'Frontend Team',
  'dept-2': 'Backend Team',
  'dept-3': 'AI Team',
  'dept-4': 'DevOps Team',
};

export default function AdminUsers() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ users: [] });
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [users] = await Promise.all([
        getUsers()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((u) => u.role === 'ADMIN');
      const currentUser = storedUser?.role === 'ADMIN' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setData({ users });
      setLoading(false);
    };
    load();
  }, []);

  const enhanced = useMemo(() => {
    let list = data.users.map((u) => ({
      ...u,
      deptName: departmentNames[u.departmentId] || '—',
    }));
    if (filterRole !== 'all') list = list.filter((u) => u.role === filterRole);
    return list;
  }, [data, filterRole]);

  if (loading || !user) return <LoadingState label="Loading users..." />;

  const roleCounts = {
    all: data.users.length,
    ADMIN: data.users.filter((u) => u.role === 'ADMIN').length,
    MANAGER: data.users.filter((u) => u.role === 'MANAGER').length,
    EMPLOYEE: data.users.filter((u) => u.role === 'EMPLOYEE').length,
  };

  return (
    <AppShell
      user={user}
      eyebrow="Admin"
      title="User management"
      description={`${roleCounts.all} total users · ${roleCounts.ADMIN} admin · ${roleCounts.MANAGER} manager · ${roleCounts.EMPLOYEE} employees`}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={roleCounts.all} detail="All accounts" icon={FiUsers} tone="blue" />
        <StatCard label="Admins" value={roleCounts.ADMIN} detail="System administrators" icon={FiShield} tone="red" />
        <StatCard label="Managers" value={roleCounts.MANAGER} detail="Department managers" icon={FiUserCheck} tone="amber" />
        <StatCard label="Employees" value={roleCounts.EMPLOYEE} detail="Team members" icon={FiUser} tone="green" />
      </div>

      <Panel title={`Users (${enhanced.length})`} description="Filter by role to manage access" className="mt-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: roleCounts.all },
            { key: 'ADMIN', label: 'Admin', count: roleCounts.ADMIN },
            { key: 'MANAGER', label: 'Manager', count: roleCounts.MANAGER },
            { key: 'EMPLOYEE', label: 'Employee', count: roleCounts.EMPLOYEE },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterRole(f.key)}
              className={`h-9 rounded-lg px-3 text-sm font-bold transition ${
                filterRole === f.key
                  ? 'bg-[#172033] text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {enhanced.length === 0 ? (
          <EmptyState icon={FiUsers} title="No users found" description="Try a different filter." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {enhanced.map((u, idx) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-4 rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-4 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-[#17212c]"
              >
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="h-12 w-12 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{u.name}</h3>
                    <StatusPill tone={roleTone(u.role)}>{u.role}</StatusPill>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <FiMail className="h-3 w-3" />
                    {u.email}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{u.deptName}</p>
                </div>
                <div className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {u.status}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function roleTone(role) {
  if (role === 'ADMIN') return 'red';
  if (role === 'MANAGER') return 'amber';
  return 'blue';
}
