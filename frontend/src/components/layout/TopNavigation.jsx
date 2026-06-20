import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiPlus, FiSettings, FiUserPlus } from 'react-icons/fi';
import { useWorkspace } from '@/context/WorkspaceContext';
import InvitationMenu from '@/components/layout/top-navigation/InvitationMenu';
import InviteMembersModal from '@/components/layout/top-navigation/InviteMembersModal';
import NotificationMenu from '@/components/layout/top-navigation/NotificationMenu';
import PageTitle from '@/components/layout/top-navigation/PageTitle';
import ProfileMenu from '@/components/layout/top-navigation/ProfileMenu';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';

export default function TopNavigation() {
  const router = useRouter();
  const {
    currentUser,
    activeWorkspace,
    userInvitations,
    showInvitations,
    setShowInvitations,
    showNotifications,
    setShowNotifications,
    notificationCount,
    markAllNotificationsRead,
    acceptInvitation,
    declineInvitation,
    setShowCreateChannel,
    logout,
    can,
    workspaceRole,
    sendInvitation,
    activeChannel,
    activeView,
  } = useWorkspace();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EMPLOYEE');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const notifRef = useRef(null);
  const invRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
      if (invRef.current && !invRef.current.contains(event.target)) setShowInvitations(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setShowNotifications, setShowInvitations]);

  const handleSendInvite = (event) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    sendInvitation(activeWorkspace?.id, inviteEmail.trim(), inviteRole);
    setInviteSuccess(`Invitation sent to ${inviteEmail}.`);
    setInviteEmail('');
    setTimeout(() => setInviteSuccess(''), 3000);
  };

  const canInvite = can('members.invite') || workspaceRole === 'OWNER' || workspaceRole === 'VICE_ADMIN';

  return (
    <header
      className="flex h-12 items-center justify-between border-b border-[#1f2022] px-4"
      style={{ backgroundColor: '#313338' }}
    >
      <PageTitle activeChannel={activeChannel} activeView={activeView} />

      <div className="flex items-center gap-1">
        {canInvite && activeWorkspace && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="top-nav-btn"
            title="Invite Members"
          >
            <FiUserPlus className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={() => setShowCreateChannel(true)}
          className="top-nav-btn"
          title="Create Channel"
        >
          <FiPlus className="h-4 w-4" />
        </button>

        <NotificationMenu
          dropdownRef={notifRef}
          showNotifications={showNotifications}
          setShowNotifications={setShowNotifications}
          notificationCount={notificationCount}
          markAllNotificationsRead={markAllNotificationsRead}
        />

        <InvitationMenu
          dropdownRef={invRef}
          showInvitations={showInvitations}
          setShowInvitations={setShowInvitations}
          userInvitations={userInvitations}
          acceptInvitation={acceptInvitation}
          declineInvitation={declineInvitation}
        />

        <button
          onClick={() => router.push('/profile')}
          className="top-nav-btn"
          title="Settings"
        >
          <FiSettings className="h-4 w-4" />
        </button>

        <AnimatedThemeToggler className="theme-toggler-button" variant="circle" duration={400} />

        <ProfileMenu
          dropdownRef={profileRef}
          currentUser={currentUser}
          showProfileMenu={showProfileMenu}
          setShowProfileMenu={setShowProfileMenu}
          logout={logout}
        />
      </div>

      {showInviteModal && (
        <InviteMembersModal
          activeWorkspace={activeWorkspace}
          inviteEmail={inviteEmail}
          inviteRole={inviteRole}
          inviteSuccess={inviteSuccess}
          setInviteEmail={setInviteEmail}
          setInviteRole={setInviteRole}
          setInviteSuccess={setInviteSuccess}
          setShowInviteModal={setShowInviteModal}
          handleSendInvite={handleSendInvite}
        />
      )}
    </header>
  );
}
