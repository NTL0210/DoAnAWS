import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion } from 'framer-motion';
import { FiArchive, FiRotateCcw, FiSave, FiTrash2, FiEdit2, FiSettings, FiUsers, FiCalendar } from 'react-icons/fi';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import WorkspaceBillingPanel from '@/components/workspace/WorkspaceBillingPanel';
import { workspacesApi } from '@/services/cloudClient';
import { emitWorkspaceRealtimeEvent } from '@/context/VoiceConnectionContext';
import {
  getPlanById,
  getPlanRank,
  getWorkspacePlan,
  getWorkspaceUsageSnapshot,
  validatePlanChange,
} from '@/services/billingService';

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
    selectWorkspace,
    workspaceMembers,
    meetings,
    trashItems,
    restoreTrashItem,
    permanentlyDeleteTrashItem,
  } = useWorkspace();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(activeWorkspace?.name || '');
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState(null);
  const [deleteWorkspaceStep, setDeleteWorkspaceStep] = useState(0);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const deleteWorkspaceRequestRef = useRef(false);

  useEffect(() => {
    setName(activeWorkspace?.name || '');
  }, [activeWorkspace?.name]);

  const canManage = can('workspace.manage') || workspaceRole === 'OWNER';
  const isMember = workspaceRole !== null;
  const billingUsage = getWorkspaceUsageSnapshot({
    workspace: activeWorkspace,
    meetings,
    members: workspaceMembers,
  });

  const handleSaveName = async () => {
    if (!name.trim() || !activeWorkspace) return;
    try {
      const saved = await workspacesApi.update(activeWorkspace.id, {
        name: name.trim(),
        expectedVersion: activeWorkspace.version || 1,
      });
      setWorkspaces((prev) => prev.map((ws) => (ws.id === saved.id ? saved : ws)));
      emitWorkspaceRealtimeEvent({
        workspaceId: activeWorkspace.id,
        type: 'WORKSPACE_STRUCTURE_CHANGED',
        payload: { reason: 'WORKSPACE_UPDATED' },
      });
      setEditingName(false);
      showToast('success', 'Workspace name updated!');
    } catch (err) {
      showToast('error', err?.message || 'Failed to update workspace name.');
    }
  };

  const handlePlanChange = (planId) => {
    if (!activeWorkspace) return;
    const currentPlan = getWorkspacePlan(activeWorkspace);
    const targetPlan = getPlanById(planId);

    // Determine if this is an upgrade or downgrade
    const currentRank = getPlanRank(currentPlan.id);
    const targetRank = getPlanRank(planId);
    const isUpgrade = targetRank > currentRank;
    const isDowngrade = targetRank < currentRank;

    // Any member can upgrade; only OWNER/VICE_ADMIN can downgrade
    if (isDowngrade && !['OWNER', 'VICE_ADMIN'].includes(workspaceRole)) {
      showToast('error', 'Only the workspace owner can downgrade the plan.');
      return;
    }

    const validation = validatePlanChange({
      currentPlan,
      targetPlan,
      usage: billingUsage,
    });
    if (!validation.allowed) {
      showToast('error', validation.message);
      return;
    }
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === activeWorkspace.id ? { ...ws, billingPlanId: planId, updatedAt: new Date().toISOString() } : ws
      )
    );
    showToast('success', isUpgrade
      ? `🚀 Workspace upgraded to ${targetPlan.name}! Thank you for supporting this workspace.`
      : `Workspace switched to ${targetPlan.name}.`
    );
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace || deleteWorkspaceRequestRef.current) return;
    const deletedWorkspaceId = activeWorkspace.id;
    deleteWorkspaceRequestRef.current = true;
    setDeletingWorkspace(true);
    try {
      await workspacesApi.delete(deletedWorkspaceId);
      finishWorkspaceDeletion(deletedWorkspaceId);
    } catch (err) {
      if (err?.statusCode === 404) {
        finishWorkspaceDeletion(deletedWorkspaceId);
      } else {
        showToast('error', err?.message || 'Failed to delete workspace.');
      }
    } finally {
      deleteWorkspaceRequestRef.current = false;
      setDeletingWorkspace(false);
    }
  };

  const finishWorkspaceDeletion = (workspaceId) => {
    const nextWorkspaces = workspaces.filter((ws) => ws.id !== workspaceId);
    setWorkspaces(nextWorkspaces);
    setDeleteWorkspaceStep(0);
    emitWorkspaceRealtimeEvent({
      workspaceId,
      type: 'WORKSPACE_DELETED',
    });
    if (nextWorkspaces[0]) {
      selectWorkspace(nextWorkspaces[0].id);
    }
    showToast('success', 'Workspace deleted.');
  };

  if (!isMember) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500 dark:text-slate-400">You do not have permission to view this workspace.</p>
      </div>
    );
  }

  // Non-manager members see only the billing panel (workspace-scoped plan upgrades)
  if (!canManage) {
    return (
      <div className="workspace-settings-page h-full w-full overflow-y-auto p-6 workspace-settings-scroll">
        <SettingsHero
          activeWorkspace={activeWorkspace}
          workspaceRole={workspaceRole}
          memberCount={workspaceMembers.length}
          trashCount={getTrashCount(trashItems)}
        />
        <div className="max-w-5xl mx-auto">
          <WorkspaceBillingPanel
            activeWorkspace={activeWorkspace}
            usage={billingUsage}
            onChangePlan={handlePlanChange}
            currentUserRole={workspaceRole}
          />
        </div>
      </div>
    );
  }

  // Full settings for OWNER / VICE_ADMIN / MANAGER
  return (
      <div className="workspace-settings-page h-full w-full overflow-y-auto p-6 workspace-settings-scroll">
      <SettingsHero
        activeWorkspace={activeWorkspace}
        workspaceRole={workspaceRole}
        memberCount={workspaceMembers.length}
        trashCount={getTrashCount(trashItems)}
      />

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ─── General ─── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm"
        >
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">General</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Workspace Name
              </label>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    id="workspace-name"
                    name="workspaceName"
                    type="text"
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
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
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeWorkspace?.name}</span>
                  <button
                    onClick={() => { setEditingName(true); setName(activeWorkspace?.name || ''); }}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Workspace ID
              </label>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
                <code className="text-sm text-slate-600 dark:text-slate-400">{activeWorkspace?.id}</code>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Created
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {activeWorkspace?.createdAt ? new Date(activeWorkspace.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </motion.section>

        <WorkspaceBillingPanel
          activeWorkspace={activeWorkspace}
          usage={billingUsage}
          onChangePlan={handlePlanChange}
          currentUserRole={workspaceRole}
        />

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <FiArchive className="h-4 w-4 text-slate-400" />
                Trash / Archive
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Deleted tasks, meetings, and teams stay here until they are restored or permanently deleted.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-black text-slate-500 dark:text-slate-400">
              {getTrashCount(trashItems)} items
            </span>
          </div>

          <div className="space-y-5">
            <TrashGroup
              title="Deleted tasks"
              type="task"
              items={trashItems?.tasks || []}
              members={workspaceMembers}
              onRestore={restoreTrashItem}
              onPermanentDelete={setPendingPermanentDelete}
            />
            <TrashGroup
              title="Deleted meetings"
              type="meeting"
              items={trashItems?.meetings || []}
              members={workspaceMembers}
              onRestore={restoreTrashItem}
              onPermanentDelete={setPendingPermanentDelete}
            />
            <TrashGroup
              title="Deleted teams"
              type="team"
              items={trashItems?.teams || []}
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
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm"
        >
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Features</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(activeWorkspace?.features || []).map((feature) => (
              <div
                key={feature.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold">
                  {feature.name[0]}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{feature.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
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
            className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 p-6"
          >
            <h2 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">Danger Zone</h2>
            <p className="text-xs text-red-600 dark:text-red-400 mb-4">
              Irreversible actions. Be careful.
            </p>
            <button
              type="button"
              onClick={() => setDeleteWorkspaceStep(1)}
              disabled={deletingWorkspace}
              className="flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-900/30 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiTrash2 className="h-4 w-4" />
              {deletingWorkspace ? 'Deleting...' : 'Delete Workspace'}
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

      {deleteWorkspaceStep === 1 ? (
        <ConfirmDialog
          title="Delete this workspace?"
          message={`This will delete "${activeWorkspace?.name || 'this workspace'}" and remove it from your workspace list.`}
          confirmLabel="Continue"
          cancelLabel="Cancel"
          onCancel={() => setDeleteWorkspaceStep(0)}
          onConfirm={() => setDeleteWorkspaceStep(2)}
        />
      ) : null}

      {deleteWorkspaceStep === 2 ? (
        <ConfirmDialog
          title="Final confirmation"
          message={`This is the second confirmation. Deleting "${activeWorkspace?.name || 'this workspace'}" cannot be undone.`}
          confirmLabel={deletingWorkspace ? 'Deleting...' : 'Delete permanently'}
          cancelLabel="Keep workspace"
          disabled={deletingWorkspace}
          onCancel={() => setDeleteWorkspaceStep(0)}
          onConfirm={handleDeleteWorkspace}
        />
      ) : null}
    </div>
  );
}

function TrashGroup({ title, type, items = [], members, onRestore, onPermanentDelete }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-400 dark:text-slate-500">
          Nothing in Trash.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{item.title || item.name || 'Untitled item'}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Deleted by {getMemberName(members, item.deletedBy)} · {formatDeletedAt(item.deletedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRestore(type, item.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/30 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <FiRotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => onPermanentDelete({ type, id: item.id, name: item.title || item.name || 'Untitled item', label: type })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/30 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-black text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
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

function SettingsHero({ activeWorkspace, workspaceRole, memberCount, trashCount }) {
  const created = activeWorkspace?.createdAt
    ? new Date(activeWorkspace.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not available';

  return (
    <section className="workspace-settings-hero relative overflow-hidden rounded-2xl p-6 text-white shadow-xl">
      <div className="workspace-settings-hero-grid" />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/12 text-lg font-black text-white shadow-lg ring-1 ring-white/20">
            {getSettingsInitials(activeWorkspace?.name)}
          </div>
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-100">
              <FiSettings className="h-3.5 w-3.5" />
              Workspace Settings
            </div>
            <h1 className="truncate text-2xl font-black md:text-3xl">{activeWorkspace?.name || 'Workspace'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Control workspace identity, billing, cleanup, and governance from one place.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-left">
          <SettingsHeroChip icon={FiUsers} label="Members" value={memberCount} />
          <SettingsHeroChip icon={FiSettings} label="Role" value={formatRole(workspaceRole)} />
          <SettingsHeroChip icon={FiCalendar} label="Created" value={created} />
        </div>
      </div>
      <div className="relative z-10 mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-[11px] font-black text-emerald-100 ring-1 ring-emerald-300/20">
          {trashCount} archived items
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-blue-100 ring-1 ring-white/15">
          Cloud synced
        </span>
      </div>
    </section>
  );
}

function SettingsHeroChip({ icon: Icon, label, value }) {
  return (
    <div className="min-w-[92px] rounded-xl border border-white/12 bg-white/10 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-300">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-black text-white">{value}</div>
    </div>
  );
}

function getSettingsInitials(name) {
  if (!name) return 'WS';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatRole(role) {
  return String(role || 'Member')
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, prefix, letter) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}

function getTrashCount(trashItems) {
  return (trashItems?.tasks?.length || 0) + (trashItems?.meetings?.length || 0) + (trashItems?.teams?.length || 0);
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
