import { FiCheck, FiMail, FiX } from 'react-icons/fi';

export default function InvitationMenu({
  dropdownRef,
  showInvitations,
  setShowInvitations,
  userInvitations,
  acceptInvitation,
  declineInvitation,
}) {
  const pendingInvites = userInvitations.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowInvitations(!showInvitations)}
        className={`top-nav-btn ${showInvitations ? 'active' : ''}`}
        title="Invitations"
      >
        <FiMail className="h-4 w-4" />
      </button>
      {pendingInvites > 0 && (
        <span className="discord-badge absolute -right-0.5 -top-0.5">{pendingInvites}</span>
      )}

      {showInvitations && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-lg border border-[#1f2022] bg-[#313338] shadow-xl">
          <div className="border-b border-[#1f2022] px-4 py-3 text-sm font-semibold text-[#dbdee1]">
            Workspace Invitations
          </div>
          <div className="max-h-80 overflow-y-auto p-3">
            {userInvitations.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#6d6f78]">
                No pending invitations
              </div>
            ) : (
              userInvitations.map((inv) => (
                <div key={inv.id} className="invitation-card mb-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5865F2] text-white text-sm font-bold">
                      {inv.workspaceName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#dbdee1]">{inv.workspaceName}</div>
                      <div className="mt-1 text-xs text-[#949ba4]">
                        Invited by <span className="text-[#dbdee1]">{inv.invitedByUserName}</span>
                      </div>
                      <div className="mt-1 text-xs text-[#949ba4]">
                        Role: <span className="font-medium text-[#b5bac1]">{inv.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => acceptInvitation(inv.id)}
                      className="discord-btn discord-btn-success flex-1 text-xs"
                    >
                      <FiCheck className="h-3 w-3" /> Accept
                    </button>
                    <button
                      onClick={() => declineInvitation(inv.id)}
                      className="discord-btn discord-btn-secondary flex-1 text-xs"
                    >
                      <FiX className="h-3 w-3" /> Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
