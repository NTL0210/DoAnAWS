import { FiLogOut, FiSettings, FiUser } from 'react-icons/fi';

export default function ProfileMenu({
  dropdownRef,
  currentUser,
  showProfileMenu,
  setShowProfileMenu,
  logout,
}) {
  const initials = currentUser?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="relative ml-2" ref={dropdownRef}>
      <button
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        className="flex items-center gap-2 rounded p-1 transition hover:bg-[#36373c]"
      >
        <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#5865F2] text-[10px] font-bold text-white">
          {currentUser?.avatar ? (
            <img src={currentUser.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
      </button>

      {showProfileMenu && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-[#1f2022] bg-[#313338] py-2 shadow-xl">
          <div className="px-4 py-2">
            <div className="text-sm font-semibold text-[#dbdee1]">{currentUser?.name}</div>
            <div className="text-xs text-[#949ba4]">{currentUser?.email}</div>
          </div>
          <div className="mx-3 border-t border-[#1f2022]" />
          <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-[#dbdee1] transition hover:bg-[#36373c]">
            <FiUser className="h-4 w-4 text-[#949ba4]" /> Profile
          </button>
          <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-[#dbdee1] transition hover:bg-[#36373c]">
            <FiSettings className="h-4 w-4 text-[#949ba4]" /> Settings
          </button>
          <div className="mx-3 border-t border-[#1f2022]" />
          <button
            onClick={() => {
              setShowProfileMenu(false);
              logout();
            }}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-[#ed4245] transition hover:bg-[#36373c]"
          >
            <FiLogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
