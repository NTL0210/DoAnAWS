import { useState, useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiUsers, FiCheckCircle, FiEdit2, FiTrash2, FiStar,
  FiMoreHorizontal, FiUserPlus, FiX,
} from 'react-icons/fi';
import CreateTeamModal from './CreateTeamModal';

const TEAM_COLORS = {
  '#5865F2': 'bg-[#5865F2]',
  '#3BA55D': 'bg-[#3BA55D]',
  '#FF8C00': 'bg-[#FF8C00]',
  '#ED4245': 'bg-[#ED4245]',
  '#9B59B6': 'bg-[#9B59B6]',
};

/**
 * WorkspaceTeamsView — View and manage teams within the workspace
 */
export default function WorkspaceTeamsView() {
  const {
    activeWorkspace,
    workspaceTeams,
    workspaceMembers,
    workspaceTasks,
    currentUser,
    can,
    workspaceRole,
    canAccessTeam,
    showCreateTeam,
    setShowCreateTeam,
    deleteTeam,
    updateTeam,
    showToast,
    addMemberToTeam,
    removeMemberFromTeam,
    assignTeamManager,
  } = useWorkspace();

  const [editingTeam, setEditingTeam] = useState(null);
  const [managingTeam, setManagingTeam] = useState(null);
  const [addingTeam, setAddingTeam] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  const canCreateTeam = can('teams.create') || can('teams.manage');
  const canManageTeam = can('teams.manage') || can('teams.delete') || workspaceRole === 'OWNER' || workspaceRole === 'VICE_ADMIN' || workspaceRole === 'MANAGER';
  const visibleTeams = useMemo(
    () => (workspaceTeams || []).filter((team) => canAccessTeam(team)),
    [workspaceTeams, canAccessTeam]
  );

  // Count tasks per team
  const teamTasks = useMemo(() => {
    const counts = {};
    visibleTeams.forEach((team) => {
      counts[team.id] = workspaceTasks.filter(
        (t) => t.departmentId === activeWorkspace?.id
      ).length;
    });
    return counts;
  }, [visibleTeams, workspaceTasks, activeWorkspace]);

  // Get member info
  const getMemberName = (userId) => {
    const member = workspaceMembers.find((m) => m.userId === userId);
    return member?.name || member?.nickname || 'Unknown';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleStartEdit = (team) => {
    setEditingTeam(team.id);
    setEditForm({ name: team.name, description: team.description || '' });
  };

  const handleSaveEdit = (teamId) => {
    if (!editForm.name.trim()) return;
    updateTeam(activeWorkspace?.id, teamId, {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
    });
    setEditingTeam(null);
  };

  const handleDeleteTeam = (teamId) => {
    deleteTeam(activeWorkspace?.id, teamId);
  };

  const handleRemoveTeamMember = (team, userId) => {
    if (team.managerId === userId) {
      showToast('error', 'Change the team manager before removing this member.');
      return;
    }
    if (userId === currentUser?.id && !['OWNER', 'VICE_ADMIN'].includes(workspaceRole)) {
      showToast('error', 'Only Owner or Vice Admin can remove themselves from a team.');
      return;
    }
    removeMemberFromTeam(activeWorkspace?.id, team.id, userId);
  };

  const handleAddTeamMember = (team, userId) => {
    if (!userId) return;
    addMemberToTeam(activeWorkspace?.id, team.id, userId);
    showToast('success', 'Member added to team.');
    setAddingTeam(null);
    setManagingTeam(team.id);
  };

  const getManagerName = (team) => {
    if (!team.managerId) return 'No manager';
    const manager = workspaceMembers.find((m) => m.userId === team.managerId);
    return manager?.name || manager?.nickname || 'Unknown';
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Teams</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {visibleTeams.length} {visibleTeams.length === 1 ? 'team' : 'teams'} in this workspace
          </p>
        </div>
        {canCreateTeam && (
          <button
            onClick={() => setShowCreateTeam(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/25 hover:bg-primary-700 transition"
          >
            <FiPlus className="h-4 w-4" /> Create Team
          </button>
        )}
      </div>

      {visibleTeams.length === 0 ? (
        /* ─── Empty State ─── */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <FiUsers className="h-8 w-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No teams yet</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
            Create your first team to organize members by function or project.
          </p>
          {canCreateTeam && (
            <button
              onClick={() => setShowCreateTeam(true)}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-primary-700 transition"
            >
              <FiPlus className="h-4 w-4" /> Create Your First Team
            </button>
          )}
        </motion.div>
      ) : (
        /* ─── Teams Grid ─── */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {visibleTeams.map((team, index) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm hover:shadow-md dark:hover:shadow-slate-950/50 transition-all"
              >
                {editingTeam === team.id ? (
                  /* ─── Edit Mode ─── */
                  <div className="space-y-3">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      autoFocus
                    />
                    <textarea
                      className="w-full min-h-[50px] resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 outline-none focus:border-primary-500"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(team.id)}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTeam(null)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ─── Header ─── */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm ${TEAM_COLORS[team.color] || 'bg-primary-500'}`}>
                          {getInitials(team.name)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-slate-100">{team.name}</h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{team.memberIds?.length || 0} members</p>
                        </div>
                      </div>
                      {canManageTeam && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleStartEdit(team)}
                            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Edit"
                          >
                            <FiEdit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ─── Description ─── */}
                    {team.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{team.description}</p>
                    )}

                    {/* ─── Manager ─── */}
                    <div className="flex items-center gap-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
                      <FiStar className="h-3 w-3 text-amber-400" />
                      <span className="font-medium">Manager:</span> {getManagerName(team)}
                    </div>

                    {/* ─── Members ─── */}
                    <div className="flex items-center gap-1 mb-4">
                      <div className="flex -space-x-2">
                        {team.memberIds?.slice(0, 5).map((uid) => {
                          const name = getMemberName(uid);
                          return (
                            <div
                              key={uid}
                              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-800 bg-primary-100 dark:bg-primary-900/40 text-[9px] font-bold text-primary-700 dark:text-primary-300"
                              title={name}
                            >
                              {getInitials(name)}
                            </div>
                          );
                        })}
                      </div>
                      {(team.memberIds?.length || 0) > 5 && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 ml-1">
                          +{team.memberIds.length - 5}
                        </span>
                      )}
                    </div>

                    {/* ─── Stats ─── */}
                    <div className="flex gap-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-3">
                      <span className="flex items-center gap-1">
                        <FiCheckCircle className="h-3 w-3" />
                        {teamTasks[team.id] || 0} tasks
                      </span>
                      <span className="flex items-center gap-1">
                        <FiUsers className="h-3 w-3" />
                        {team.memberIds?.length || 0} members
                      </span>
                    </div>

                    {canManageTeam ? (
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingTeam(addingTeam === team.id ? null : team.id);
                            setManagingTeam(null);
                          }}
                          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-primary-600/20 transition hover:bg-primary-700"
                        >
                          <FiUserPlus className="h-3.5 w-3.5" />
                          Add Member
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setManagingTeam(managingTeam === team.id ? null : team.id);
                            setAddingTeam(null);
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <FiMoreHorizontal className="h-3.5 w-3.5" />
                          Manage
                        </button>
                      </div>
                    ) : null}

                    {addingTeam === team.id && (
                      <div className="mt-3 rounded-xl border border-primary-100 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">Add member to {team.name}</p>
                          <button
                            type="button"
                            onClick={() => setAddingTeam(null)}
                            className="rounded-md p-1 text-primary-400 hover:bg-white dark:hover:bg-slate-800 hover:text-primary-600 dark:hover:text-primary-300"
                          >
                            <FiX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <select
                          className="w-full rounded-lg border border-primary-200 dark:border-primary-800 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-primary-500"
                          defaultValue=""
                          onChange={(e) => handleAddTeamMember(team, e.target.value)}
                        >
                          <option value="">Select workspace member...</option>
                          {workspaceMembers
                            .filter((member) => !(team.memberIds || []).includes(member.userId))
                            .map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.name || member.nickname || 'Unknown'}
                              </option>
                            ))}
                        </select>
                        {workspaceMembers.every((member) => (team.memberIds || []).includes(member.userId)) && (
                          <p className="mt-2 text-xs font-medium text-primary-500 dark:text-primary-400">All workspace members are already in this team.</p>
                        )}
                      </div>
                    )}

                    {managingTeam === team.id && (
                      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                        <div>
                          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Manager</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-primary-500"
                            value={team.managerId || ''}
                            onChange={(e) => assignTeamManager(activeWorkspace?.id, team.id, e.target.value)}
                          >
                            <option value="">No manager</option>
                            {workspaceMembers.map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.name || member.nickname || 'Unknown'}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Current Members</p>
                          <div className="space-y-1">
                            {(team.memberIds || []).map((userId) => (
                              <div key={userId} className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-800 px-2.5 py-2 text-xs">
                                <span className="min-w-0 truncate font-semibold text-slate-600 dark:text-slate-300">
                                  {getMemberName(userId)}
                                  {team.managerId === userId ? ' · Manager' : ''}
                                  {currentUser?.id === userId ? ' · You' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeamMember(team, userId)}
                                  disabled={team.managerId === userId}
                                  className="rounded-md px-2 py-1 font-bold text-red-500 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20 disabled:cursor-not-allowed disabled:text-slate-300 dark:disabled:text-slate-600"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {showCreateTeam && <CreateTeamModal onClose={() => setShowCreateTeam(false)} />}
    </div>
  );
}
