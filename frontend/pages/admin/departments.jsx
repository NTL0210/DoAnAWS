import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiBriefcase, FiLoader, FiPlus, FiUsers, FiCheckCircle } from 'react-icons/fi';
import AppShell, { Panel, StatCard, StatusPill, LoadingState, EmptyState } from '../../src/components/layout/AppShell';
import { getDepartments as getMockDepartments, getUsers, getTasks as getMockTasks } from '../../src/services/legacyDataService';

export default function AdminDepartments() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ departments: [], users: [], tasks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [departments, users, tasks] = await Promise.all([
        getMockDepartments(), getUsers(), getMockTasks()
      ]);
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const fallback = users.find((u) => u.role === 'ADMIN');
      const currentUser = storedUser?.role === 'ADMIN' ? { ...fallback, ...storedUser } : fallback;
      await new Promise((r) => setTimeout(r, 300));
      setUser(currentUser);
      setData({ departments, users, tasks });
      setLoading(false);
    };
    load();
  }, []);

  const enhanced = useMemo(() => {
    if (!data.departments.length) return [];
    return data.departments.map((dept) => {
      const manager = data.users.find((u) => u.id === dept.managerId);
      const members = data.users.filter((u) => dept.memberIds.includes(u.id));
      const deptTasks = data.tasks.filter((t) => t.departmentId === dept.id);
      return {
        ...dept,
        managerName: manager?.name || 'Unassigned',
        memberCount: members.length,
        taskCount: deptTasks.length,
        completed: deptTasks.filter((t) => t.status === 'COMPLETED').length,
        progress: deptTasks.length
          ? Math.round(deptTasks.reduce((s, t) => s + t.progress, 0) / deptTasks.length)
          : 0,
      };
    });
  }, [data]);

  if (loading || !user) return <LoadingState label="Loading departments..." />;

  const totalMembers = enhanced.reduce((s, d) => s + d.memberCount, 0);
  const totalTasks = enhanced.reduce((s, d) => s + d.taskCount, 0);

  return (
    <AppShell
      user={user}
      eyebrow="Admin"
      title="Departments"
      description={`${enhanced.length} departments · ${totalMembers} total members · ${totalTasks} tasks tracked`}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Departments" value={enhanced.length} detail="Operating units" icon={FiBriefcase} tone="blue" />
        <StatCard label="Members" value={totalMembers} detail="Across departments" icon={FiUsers} tone="green" />
        <StatCard label="Total tasks" value={totalTasks} detail="All departments" icon={FiCheckCircle} tone="amber" />
        <StatCard label="Avg completion" value={`${enhanced.length ? Math.round(enhanced.reduce((s, d) => s + d.progress, 0) / enhanced.length) : 0}%`} detail="Department average" icon={FiBriefcase} tone="slate" />
      </div>

      <Panel title="All departments" description="Overview of every department and its metrics" className="mt-6">
        {enhanced.length === 0 ? (
          <EmptyState icon={FiBriefcase} title="No departments" description="Create your first department to get started." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {enhanced.map((dept, idx) => (
              <motion.div
                key={dept.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-lg border border-slate-200/80 bg-[#f4f7fb] p-5 transition hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{dept.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Manager: <span className="font-semibold">{dept.managerName}</span>
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                    <FiBriefcase className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-white/80 p-2 dark:bg-slate-800">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{dept.memberCount}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Members</p>
                  </div>
                  <div className="rounded-md bg-white/80 p-2 dark:bg-slate-800">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{dept.taskCount}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Tasks</p>
                  </div>
                  <div className="rounded-md bg-white/80 p-2 dark:bg-slate-800">
                    <p className="text-lg font-bold text-emerald-600">{dept.completed}</p>
                    <p className="text-[10px] font-semibold text-slate-500">Done</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Progress</span>
                    <span>{dept.progress}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-sky-400 transition-all"
                      style={{ width: `${dept.progress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
