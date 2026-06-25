import { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion } from 'framer-motion';
import { FiX, FiLoader } from 'react-icons/fi';

const TEAM_COLORS = [
  { value: '#5865F2', label: 'Blue' },
  { value: '#3BA55D', label: 'Green' },
  { value: '#FF8C00', label: 'Orange' },
  { value: '#ED4245', label: 'Red' },
  { value: '#9B59B6', label: 'Purple' },
];

/**
 * CreateTeamModal — Modal for creating a new team in a workspace
 */
export default function CreateTeamModal({ onClose }) {
  const { createTeam, activeWorkspace, workspaceMembers, currentUser, workspaceRole } = useWorkspace();
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: TEAM_COLORS[0].value,
    managerId: currentUser?.id || '',
    memberIds: currentUser?.id ? [currentUser.id] : [],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Team name is required');
      return;
    }
    if (form.name.trim().length < 2) {
      setError('Team name must be at least 2 characters');
      return;
    }

    setIsCreating(true);
    await new Promise((r) => setTimeout(r, 300));

    const memberIds = Array.from(new Set([
      ...form.memberIds,
      currentUser?.id,
      form.managerId,
    ].filter(Boolean)));

    const created = createTeam(activeWorkspace?.id, {
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      managerId: form.managerId || null,
      memberIds,
    });

    setIsCreating(false);
    if (!created) {
      setError('Unable to create this team right now. Check workspace permissions or billing status.');
      return;
    }
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Team</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:hover:bg-slate-700 dark:hover:text-slate-300">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Team Name</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="e.g., Frontend Team"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              maxLength={50}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</label>
            <textarea
              className="w-full min-h-[60px] resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="What does this team do?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Color</label>
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`h-8 w-8 rounded-full transition-all duration-200 ${
                    form.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 dark:ring-offset-slate-900' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Team Manager</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={form.managerId}
              onChange={(e) => {
                const managerId = e.target.value;
                setForm({
                  ...form,
                  managerId,
                  memberIds: managerId ? Array.from(new Set([...form.memberIds, managerId])) : form.memberIds,
                });
              }}
            >
              <option value="">Select manager...</option>
              {workspaceMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.nickname || 'Unknown'} {m.userId === currentUser?.id ? '(you)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Initial Members</label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
              {workspaceMembers.map((m) => {
                const checked = form.memberIds.includes(m.userId);
                const locked = m.userId === currentUser?.id || m.userId === form.managerId;
                return (
                  <label key={m.userId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      checked={checked}
                      disabled={locked}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          memberIds: e.target.checked
                            ? Array.from(new Set([...prev.memberIds, m.userId]))
                            : prev.memberIds.filter((id) => id !== m.userId),
                        }));
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {m.name || m.nickname || 'Unknown'} {m.userId === currentUser?.id ? '(you)' : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300"
            >
              {error}
            </motion.div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !form.name.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400 disabled:shadow-none transition dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            >
              {isCreating ? (
                <><FiLoader className="h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                'Create Team'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
