import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiLock, FiPlus, FiShield, FiTrash2, FiX } from 'react-icons/fi';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  ALL_WORKSPACE_PERMISSIONS,
  DEFAULT_ROLES,
  PERMISSION_LABELS,
  WORKSPACE_PERMISSION_GROUPS,
} from '@/data/defaults/roles';

const ROLE_COLORS = ['#5865F2', '#3BA55D', '#FF8C00', '#ED4245', '#9B59B6', '#0891B2'];
const EMPTY_ROLE = {
  name: '',
  description: '',
  color: ROLE_COLORS[0],
  permissions: ['workspace.view', 'members.view', 'teams.view', 'tasks.view', 'meetings.join', 'chat.send'],
};

export default function WorkspaceRoleManager({ onClose }) {
  const {
    activeWorkspace,
    workspaceMembers,
    workspaceRole,
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
    getAllPermissions,
  } = useWorkspace();
  const customRoles = activeWorkspace?.customRoles || [];
  const [selectedId, setSelectedId] = useState('new');
  const [form, setForm] = useState(EMPTY_ROLE);
  const [saving, setSaving] = useState(false);

  const roleItems = useMemo(() => [
    ...Object.entries(DEFAULT_ROLES).map(([id, role]) => ({ id, ...role })),
    ...customRoles,
  ], [customRoles]);
  const selectedRole = roleItems.find((role) => role.id === selectedId) || null;
  const isSystemRole = Boolean(selectedRole?.isSystem);
  const memberCount = selectedRole
    ? workspaceMembers.filter((member) => member.role === selectedRole.id).length
    : 0;
  const actorPermissions = getAllPermissions();
  const grantablePermissions = new Set(
    actorPermissions === 'all' || workspaceRole === 'OWNER'
      ? ALL_WORKSPACE_PERMISSIONS
      : actorPermissions,
  );

  useEffect(() => {
    if (selectedId === 'new') {
      setForm(EMPTY_ROLE);
      return;
    }
    if (!selectedRole) return;
    setForm({
      name: selectedRole.name || '',
      description: selectedRole.description || '',
      color: selectedRole.color || ROLE_COLORS[0],
      permissions: [...(selectedRole.permissions || [])],
    });
  }, [selectedId, selectedRole]);

  const togglePermission = (permission) => {
    if (isSystemRole || !grantablePermissions.has(permission)) return;
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const toggleGroup = (permissions) => {
    if (isSystemRole) return;
    const grantable = permissions.filter((permission) => grantablePermissions.has(permission));
    const allSelected = grantable.every((permission) => form.permissions.includes(permission));
    setForm((current) => ({
      ...current,
      permissions: allSelected
        ? current.permissions.filter((permission) => !grantable.includes(permission))
        : Array.from(new Set([...current.permissions, ...grantable])),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    const lockedPermissions = selectedId === 'new'
      ? []
      : (selectedRole?.permissions || []).filter((permission) => !grantablePermissions.has(permission));
    const payload = {
      ...form,
      permissions: Array.from(new Set([
        ...form.permissions.filter((permission) => grantablePermissions.has(permission)),
        ...lockedPermissions,
      ])),
    };
    if (selectedId === 'new') {
      const created = await createCustomRole(activeWorkspace?.id, payload);
      if (created) setSelectedId(created.id);
    } else if (!isSystemRole) {
      await updateCustomRole(activeWorkspace?.id, selectedId, payload);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedRole || isSystemRole || memberCount > 0) return;
    if (!confirm(`Delete role "${selectedRole.name}"?`)) return;
    const deleted = await deleteCustomRole(activeWorkspace?.id, selectedRole.id);
    if (deleted) setSelectedId('new');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[min(760px,92vh)] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-4 py-4">
            <p className="text-xs font-black uppercase text-slate-500">Workspace roles</p>
            <h2 className="mt-1 text-base font-black text-white">Roles & permissions</h2>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-3">
            {roleItems.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedId(role.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                  selectedId === role.id ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
                <span className="min-w-0 flex-1 truncate font-bold">{role.name}</span>
                {role.isSystem && <FiLock className="h-3.5 w-3.5 text-slate-500" />}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-800 p-3">
            <button
              type="button"
              onClick={() => setSelectedId('new')}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2.5 text-sm font-black text-white hover:bg-blue-500"
            >
              <FiPlus className="h-4 w-4" /> New role
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-950">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FiShield className="h-4 w-4 text-orange-400" />
                <h3 className="truncate text-base font-black text-white">
                  {selectedId === 'new' ? 'Create role' : selectedRole?.name}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">{selectedRole ? `${memberCount} members` : 'Custom role'}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white" title="Close">
              <FiX className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase text-slate-500">Role name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={isSystemRole}
                  maxLength={50}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-60"
                  placeholder="e.g., QA Lead"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase text-slate-500">Color</label>
                <div className="flex h-[42px] items-center gap-2">
                  {ROLE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      disabled={isSystemRole}
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      className={`h-7 w-7 rounded-full border-2 transition ${form.color === color ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase text-slate-500">Description</label>
              <input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                disabled={isSystemRole}
                maxLength={240}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-60"
                placeholder="Role purpose"
              />
            </div>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-black text-white">Permissions</h4>
                <span className="text-xs font-bold text-slate-500">{form.permissions.length} enabled</span>
              </div>
              <div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                {WORKSPACE_PERMISSION_GROUPS.map((group) => {
                  const grantable = group.permissions.filter((permission) => grantablePermissions.has(permission));
                  const allSelected = grantable.length > 0 && grantable.every((permission) => form.permissions.includes(permission));
                  return (
                    <div key={group.id} className="p-4">
                      <button
                        type="button"
                        disabled={isSystemRole || grantable.length === 0}
                        onClick={() => toggleGroup(group.permissions)}
                        className="mb-3 flex items-center gap-2 text-left text-xs font-black uppercase text-slate-300 disabled:cursor-default"
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${allSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600'}`}>
                          {allSelected && <FiCheck className="h-3 w-3" />}
                        </span>
                        {group.label}
                      </button>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((permission) => {
                          const checked = form.permissions.includes(permission);
                          const grantablePermission = grantablePermissions.has(permission);
                          return (
                            <label
                              key={permission}
                              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${grantablePermission ? 'cursor-pointer text-slate-300 hover:bg-slate-900' : 'cursor-not-allowed text-slate-600'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isSystemRole || !grantablePermission}
                                onChange={() => togglePermission(permission)}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500"
                              />
                              <span>{PERMISSION_LABELS[permission]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {!isSystemRole && (
            <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
              <button
                type="button"
                onClick={handleDelete}
                disabled={selectedId === 'new' || memberCount > 0 || saving}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-red-400 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <FiTrash2 className="h-4 w-4" /> Delete
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {saving ? 'Saving...' : selectedId === 'new' ? 'Create role' : 'Save changes'}
              </button>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
