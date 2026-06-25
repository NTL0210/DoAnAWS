import { useEffect, useMemo, useState } from 'react';
import { FiBriefcase, FiCheckSquare, FiHeadphones, FiMic, FiSearch, FiSettings, FiUploadCloud, FiUsers, FiX } from 'react-icons/fi';
import useDebounce from '@/hooks/useDebounce';

export default function CommandPalette({
  open,
  onClose,
  onOpenView,
  onCreateTeam,
  onInviteMember,
  onJoinVoice,
  onToggleMute,
  onToggleDeafen,
  meetings = [],
  tasks = [],
  members = [],
  teams = [],
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  const items = useMemo(() => {
    const base = [
      { id: 'meetings', label: 'Open Meetings', group: 'Navigate', icon: FiUploadCloud, action: () => onOpenView('meetings') },
      { id: 'tasks', label: 'Open My Tasks', group: 'Navigate', icon: FiCheckSquare, action: () => onOpenView('tasks') },
      { id: 'members', label: 'Open Members', group: 'Navigate', icon: FiUsers, action: () => onOpenView('members') },
      { id: 'teams', label: 'Open Teams', group: 'Navigate', icon: FiBriefcase, action: () => onOpenView('teams') },
      { id: 'settings', label: 'Open Settings', group: 'Navigate', icon: FiSettings, action: () => onOpenView('settings') },
      { id: 'upload', label: 'Upload meeting', group: 'Actions', icon: FiUploadCloud, action: () => onOpenView('meetings') },
      { id: 'create-team', label: 'Create team', group: 'Actions', icon: FiBriefcase, action: onCreateTeam },
      { id: 'invite', label: 'Invite member', group: 'Actions', icon: FiUsers, action: onInviteMember },
      { id: 'join-voice', label: 'Join first voice channel', group: 'Voice', icon: FiHeadphones, action: onJoinVoice },
      { id: 'mute', label: 'Mute or unmute mic', group: 'Voice', icon: FiMic, action: onToggleMute },
      { id: 'deafen', label: 'Toggle deafen', group: 'Voice', icon: FiHeadphones, action: onToggleDeafen },
    ];
    const searchRows = [
      ...meetings.slice(0, 6).map((item) => ({ id: `meeting-${item.id}`, label: item.title, group: 'Meetings', icon: FiUploadCloud, action: () => onOpenView('meetings') })),
      ...tasks.slice(0, 8).map((item) => ({ id: `task-${item.id}`, label: item.title, group: 'Tasks', icon: FiCheckSquare, action: () => onOpenView('tasks') })),
      ...members.slice(0, 8).map((item) => ({ id: `member-${item.userId}`, label: item.name || item.nickname || item.userId, group: 'Members', icon: FiUsers, action: () => onOpenView('members') })),
      ...teams.slice(0, 8).map((item) => ({ id: `team-${item.id}`, label: item.name, group: 'Teams', icon: FiBriefcase, action: () => onOpenView('teams') })),
    ];
    return [...base, ...searchRows];
  }, [meetings, members, onCreateTeam, onInviteMember, onJoinVoice, onOpenView, onToggleDeafen, onToggleMute, tasks, teams]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter((item) => `${item.group} ${item.label}`.toLowerCase().includes(q)).slice(0, 20);
  }, [debouncedQuery, items]);

  if (!open) return null;

  const run = (item) => {
    item.action?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 px-4 pt-[12vh] dark:bg-slate-950/60" onMouseDown={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <FiSearch className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search meetings, tasks, members, teams, actions..."
            className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400 dark:text-slate-500">No results</div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => run(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/60">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-800 dark:text-slate-100">{item.label}</span>
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.group}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
