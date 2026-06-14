import { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion } from 'framer-motion';
import { FiCheck, FiLoader, FiPlus, FiX } from 'react-icons/fi';

export default function CreateWorkspaceModal({ isModal = false, onClose }) {
  const { createWorkspace, currentUser } = useWorkspace();
  const [form, setForm] = useState({
    name: '',
    description: '',
    iconColor: 'blue',
    workspaceType: 'blank',
    visibility: 'private',
    createDefaultTextChannel: true,
    createDefaultVoiceChannel: true,
  });
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Please enter a workspace name.');
      return;
    }
    if (form.name.trim().length < 2) {
      setError('Workspace name must be at least 2 characters.');
      return;
    }
    setIsCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const workspace = createWorkspace(
      {
        name: form.name.trim(),
        description: form.description.trim(),
        iconColor: form.iconColor,
        workspaceType: form.workspaceType,
        visibility: form.visibility,
      },
      {
        createDefaultTextChannel: form.createDefaultTextChannel,
        createDefaultVoiceChannel: form.createDefaultVoiceChannel,
      }
    );
    setIsCreating(false);
    if (!workspace) {
      setError('Unable to create workspace.');
      return;
    }
    setCreated(true);
    setTimeout(() => onClose?.(), 700);
  };

  const content = (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-xl">
      {created ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <FiCheck className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Workspace created</h1>
          <p className="mt-2 text-sm text-slate-500">Switching you into the new clean workspace.</p>
        </div>
      ) : (
        <form onSubmit={handleCreate}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Create Workspace</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Hi {currentUser?.name?.split(' ')[0] || 'there'}, this creates a clean workspace where you are the Owner.
              </p>
            </div>
            {isModal ? (
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <FiX className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="grid gap-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Workspace name</span>
              <input
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                placeholder="Acme Team"
                autoFocus
                maxLength={50}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                placeholder="Optional"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField label="Type" value={form.workspaceType} onChange={(value) => update('workspaceType', value)} options={[
                ['blank', 'Blank Workspace'],
                ['company', 'Company Workspace'],
                ['team', 'Team Workspace'],
              ]} />
              <SelectField label="Visibility" value={form.visibility} onChange={(value) => update('visibility', value)} options={[
                ['private', 'Private'],
                ['internal', 'Internal'],
              ]} />
              <SelectField label="Color" value={form.iconColor} onChange={(value) => update('iconColor', value)} options={[
                ['blue', 'Blue'],
                ['emerald', 'Emerald'],
                ['violet', 'Violet'],
              ]} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Defaults</p>
              <label className="mt-3 flex items-center justify-between gap-4 text-sm font-bold text-slate-600">
                Create default text channel
                <input type="checkbox" checked={form.createDefaultTextChannel} onChange={(event) => update('createDefaultTextChannel', event.target.checked)} />
              </label>
              <label className="mt-3 flex items-center justify-between gap-4 text-sm font-bold text-slate-600">
                Create default voice channel
                <input type="checkbox" checked={form.createDefaultVoiceChannel} onChange={(event) => update('createDefaultVoiceChannel', event.target.checked)} />
              </label>
            </div>
          </div>

          {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

          <button
            type="submit"
            disabled={isCreating || !form.name.trim()}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isCreating ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlus className="h-4 w-4" />}
            {isCreating ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      )}
    </motion.div>
  );

  if (!isModal) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}
