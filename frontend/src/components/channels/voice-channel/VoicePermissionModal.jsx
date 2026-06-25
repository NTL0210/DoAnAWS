import { useState } from 'react';
import { FiCheck, FiMoreHorizontal, FiX } from 'react-icons/fi';
import { getDisplayName } from './voiceFormatters';

export default function VoicePermissionModal({ channel, teams, members, onClose, onSave }) {
  const [scope, setScope] = useState(channel.scope || 'WORKSPACE');
  const [allowedTeamIds, setAllowedTeamIds] = useState(channel.allowedTeamIds || []);
  const [allowedUserIds, setAllowedUserIds] = useState(channel.allowedUserIds || []);
  const [allowRecording, setAllowRecording] = useState(channel.allowRecording !== false);
  const [isLocked, setIsLocked] = useState(Boolean(channel.isLocked));

  const toggleTeam = (teamId) => {
    setAllowedTeamIds((prev) => prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]);
  };
  const toggleUser = (userId) => {
    setAllowedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Voice permissions</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">{channel.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Scope</label>
          <div className="grid grid-cols-3 gap-2">
            {['WORKSPACE', 'TEAM', 'CUSTOM'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={`rounded-xl border px-3 py-2 text-xs font-black ${scope === item ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                {item}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Allowed teams</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {teams.map((team) => (
                <button key={team.id} type="button" onClick={() => toggleTeam(team.id)} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  {team.name}
                  {allowedTeamIds.includes(team.id) ? <FiCheck className="h-4 w-4 text-blue-600" /> : <FiMoreHorizontal className="h-4 w-4 text-slate-300 dark:text-slate-500" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Allowed users</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((member) => (
                <button key={member.userId} type="button" onClick={() => toggleUser(member.userId)} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  {getDisplayName(member)}
                  {allowedUserIds.includes(member.userId) ? <FiCheck className="h-4 w-4 text-blue-600" /> : <FiMoreHorizontal className="h-4 w-4 text-slate-300 dark:text-slate-500" />}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300">
            Lock voice
            <input type="checkbox" checked={isLocked} onChange={(event) => setIsLocked(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300">
            Allow recording
            <input type="checkbox" checked={allowRecording} onChange={(event) => setAllowRecording(event.target.checked)} />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ scope, allowedTeamIds, allowedUserIds, allowRecording, isLocked })}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
          >
            Save permissions
          </button>
        </div>
      </div>
    </div>
  );
}
