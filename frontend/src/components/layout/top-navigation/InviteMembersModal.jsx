import { FiSend } from 'react-icons/fi';

export default function InviteMembersModal({
  activeWorkspace,
  inviteEmail,
  inviteRole,
  inviteSuccess,
  setInviteEmail,
  setInviteRole,
  setInviteSuccess,
  setShowInviteModal,
  handleSendInvite,
}) {
  return (
    <div className="discord-modal-overlay" onClick={() => { setShowInviteModal(false); setInviteSuccess(''); }}>
      <div className="discord-modal" onClick={(e) => e.stopPropagation()}>
        <div className="discord-modal-header">Invite Members</div>
        <div className="discord-modal-body">
          <p className="mb-4 text-sm text-[#949ba4]">
            Invite people to <strong className="text-[#dbdee1]">{activeWorkspace?.name}</strong>
          </p>
          <form onSubmit={handleSendInvite}>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                className="discord-input"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide">
                Role
              </label>
              <select
                className="discord-input"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="VICE_ADMIN">Vice Admin</option>
              </select>
            </div>
            {inviteSuccess && (
              <div className="mb-3 rounded border border-[#3ba55d]/30 bg-[#3ba55d]/10 px-3 py-2 text-sm text-[#3ba55d]">
                {inviteSuccess}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowInviteModal(false); setInviteSuccess(''); }}
                className="discord-btn discord-btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="discord-btn discord-btn-primary">
                <FiSend className="h-3.5 w-3.5" /> Send Invite
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
