import { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion } from 'framer-motion';
import { FiUserPlus, FiShield, FiX, FiCheck, FiMail, FiUser } from 'react-icons/fi';

const ROLE_OPTIONS = ['OWNER', 'VICE_ADMIN', 'MANAGER', 'EMPLOYEE'];

/**
 * WorkspaceMembersView — View and manage workspace members
 */
export default function WorkspaceMembersView() {
  const {
    workspaceMembers,
    workspaceTeams,
    activeWorkspace,
    workspaceRole,
    can,
    currentUser,
    updateMemberRole,
    removeMember,
    showInviteMember,
    setShowInviteMember,
    sendInvitation,
    showToast,
    workspaceRoleLabels,
    workspaceRoleColors,
  } = useWorkspace();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EMPLOYEE');
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [sendingInvite, setSendingInvite] = useState(false);

  const canInvite = can('members.invite') || workspaceRole === 'OWNER' || workspaceRole === 'VICE_ADMIN';
  const canManageRoles = can('roles.manage') || workspaceRole === 'OWNER';
  const canRemove = can('members.remove') || workspaceRole === 'OWNER';

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSendingInvite(true);
    await new Promise((r) => setTimeout(r, 400));

    sendInvitation(activeWorkspace?.id, inviteEmail.trim(), inviteRole, selectedTeamIds);
    setInviteEmail('');
    setSelectedTeamIds([]);
    setSendingInvite(false);
  };

  const handleRoleChange = (userId, newRole) => {
    if (confirm(`Change role to ${newRole}?`)) {
      updateMemberRole(activeWorkspace?.id, userId, newRole);
    }
  };

  const handleRemove = (userId) => {
    const member = workspaceMembers.find((m) => m.userId === userId);
    if (userId === currentUser?.id) {
      alert('You cannot remove yourself.');
      return;
    }
    if (confirm(`Remove ${member?.name || 'this user'} from workspace?`)) {
      removeMember(activeWorkspace?.id, userId);
      showToast('info', 'Member removed from workspace');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500 mt-1">
            {workspaceMembers.length} {workspaceMembers.length === 1 ? 'member' : 'members'} in this workspace
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteMember(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/25 hover:bg-primary-700 transition"
          >
            <FiUserPlus className="h-4 w-4" /> Invite Member
          </button>
        )}
      </div>

      {/* ─── Invite Form ─── */}
      {showInviteMember && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-primary-900">Invite a new member</h3>
            <button onClick={() => setShowInviteMember(false)} className="text-primary-400 hover:text-primary-600">
              <FiX className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="email"
                  className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <select
                className="rounded-lg border border-primary-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-500"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{workspaceRoleLabels[r] || r}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={sendingInvite || !inviteEmail.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition"
              >
                <FiMail className="h-4 w-4" />
                {sendingInvite ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary-700">Assign to teams</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(workspaceTeams || []).map((team) => (
                  <label key={team.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={(e) => {
                        setSelectedTeamIds((prev) =>
                          e.target.checked
                            ? Array.from(new Set([...prev, team.id]))
                            : prev.filter((id) => id !== team.id)
                        );
                      }}
                    />
                    <span className="min-w-0 truncate">{team.name}</span>
                  </label>
                ))}
                {(workspaceTeams || []).length === 0 && (
                  <p className="text-xs text-primary-500">No teams available yet.</p>
                )}
              </div>
            </div>
          </form>
        </motion.div>
      )}

      {/* ─── Members List ─── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {workspaceMembers.map((m, index) => {
            const isCurrent = m.userId === currentUser?.id;
            return (
              <motion.div
                key={m.userId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {getInitials(m.name || m.nickname)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">
                      {m.name || m.nickname || 'Unknown'}
                    </p>
                    {isCurrent && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">You</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Joined {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Recently'}
                  </p>
                </div>

                {/* Role Badge / Select */}
                {canManageRoles && !isCurrent ? (
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-primary-500"
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{workspaceRoleLabels[r] || r}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${workspaceRoleColors[m.role] || 'bg-slate-100 text-slate-600'}`}>
                    <FiShield className="inline h-3 w-3 mr-1" />
                    {workspaceRoleLabels[m.role] || m.role}
                  </span>
                )}

                {/* Remove button */}
                {canRemove && !isCurrent && (
                  <button
                    onClick={() => handleRemove(m.userId)}
                    className="rounded-lg p-2 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                    title="Remove member"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            );
          })}

          {workspaceMembers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FiUser className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No members yet. Invite your team to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
