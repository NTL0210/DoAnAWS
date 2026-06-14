import { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion } from 'framer-motion';
import { FiArchive, FiRotateCcw, FiSave, FiTrash2, FiEdit2 } from 'react-icons/fi';
import ConfirmDialog from '@/components/common/ConfirmDialog';

/**
 * WorkspaceSettingsView — Workspace-level settings
 */
export default function WorkspaceSettingsView() {
  const {
    activeWorkspace,
    workspaceRole,
    can,
    showToast,
    workspaces,
    setWorkspaces,
    workspaceMembers,
    trashItems,
    restoreTrashItem,
    permanentlyDeleteTrashItem,
  } = useWorkspace();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(activeWorkspace?.name || '');
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState(null);

  const canManage = can('workspace.manage') || workspaceRole === 'OWNER';

  const handleSaveName = () => {
    if (!name.trim() || !activeWorkspace) return;
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === activeWorkspace.id ? { ...ws, name: name.trim() } : ws
      )
    );
    setEditingName(false);
    showToast('success', 'Workspace name updated!');
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">You do not have permission to manage workspace settings.</p>
      </div>
    );
  }

  return (
    <div className="h-full max-w-4xl overflow-y-auto p-6">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Workspace Settings</h1>

      <div className="space-y-6">
        {/* ─── General ─── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-bold text-slate-900 mb-4">General</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Workspace Name
              </label>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition"
                  >
                    <FiSave className="h-4 w-4" /> Save
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setName(activeWorkspace?.name || ''); }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-900">{activeWorkspace?.name}</span>
                  <button
                    onClick={() => { setEditingName(true); setName(activeWorkspace?.name || ''); }}
                    className="text-slate-400 hover:text-slate-600 transition"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Workspace ID
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <code className="text-sm text-slate-600">{activeWorkspace?.id}</code>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Created
              </label>
              <p className="text-sm text-slate-600">
                {activeWorkspace?.createdAt ? new Date(activeWorkspace.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FiArchive className="h-4 w-4 text-slate-400" />
                Trash / Archive
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Deleted tasks, meetings, and teams stay here until they are restored or permanently deleted.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
              {getTrashCount(trashItems)} items
            </span>
          </div>

          <div className="space-y-5">
            <TrashGroup
              title="Deleted tasks"
              type="task"
              items={trashItems.tasks}
              members={workspaceMembers}
              onRestore={restoreTrashItem}
              onPermanentDelete={setPendingPermanentDelete}
            />
            <TrashGroup
              title="Deleted meetings"
              type="meeting"
              items={trashItems.meetings}
              members={workspaceMembers}
              onRestore={restoreTrashItem}
              onPermanentDelete={setPendingPermanentDelete}
            />
            <TrashGroup
              title="Deleted teams"
              type="team"
              items={trashItems.teams}
              members={workspaceMembers}
              onRestore={restoreTrashItem}
              onPermanentDelete={setPendingPermanentDelete}
            />
          </div>
        </motion.section>

        {/* ─── Workspace Features ─── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-bold text-slate-900 mb-4">Features</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(activeWorkspace?.features || []).map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-xs font-bold">
                  {feature.name[0]}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{feature.name}</p>
                  <p className="text-xs text-slate-400">
                    {feature.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ─── Danger Zone ─── */}
        {workspaceRole === 'OWNER' && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-red-200 bg-red-50/50 p-6"
          >
            <h2 className="text-sm font-bold text-red-800 mb-2">Danger Zone</h2>
            <p className="text-xs text-red-600 mb-4">
              Irreversible actions. Be careful.
            </p>
            <button
              disabled
              className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 opacity-50 cursor-not-allowed"
            >
              <FiTrash2 className="h-4 w-4" />
              Delete Workspace (coming soon)
            </button>
          </motion.section>
        )}
      </div>

      {pendingPermanentDelete ? (
        <ConfirmDialog
          title={`Permanently delete ${pendingPermanentDelete.label}?`}
          message={`This will remove "${pendingPermanentDelete.name}" from Trash permanently.`}
          confirmLabel="Permanently delete"
          onCancel={() => setPendingPermanentDelete(null)}
          onConfirm={() => {
            permanentlyDeleteTrashItem(pendingPermanentDelete.type, pendingPermanentDelete.id);
            setPendingPermanentDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TrashGroup({ title, type, items, members, onRestore, onPermanentDelete }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-400">
          Nothing in Trash.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{item.title || item.name || 'Untitled item'}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Deleted by {getMemberName(members, item.deletedBy)} · {formatDeletedAt(item.deletedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRestore(type, item.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-50"
                >
                  <FiRotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => onPermanentDelete({ type, id: item.id, name: item.title || item.name || 'Untitled item', label: type })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                  Permanently delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getTrashCount(trashItems) {
  return (trashItems.tasks?.length || 0) + (trashItems.meetings?.length || 0) + (trashItems.teams?.length || 0);
}

function getMemberName(members, userId) {
  if (!userId) return 'Unknown';
  const member = (members || []).find((item) => item.userId === userId);
  return member?.name || member?.nickname || 'Unknown';
}

function formatDeletedAt(value) {
  if (!value) return 'Date not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not available';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
