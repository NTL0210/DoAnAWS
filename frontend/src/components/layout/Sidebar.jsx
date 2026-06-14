import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { authService } from '../../lib/auth';
import { FiMenu, FiX, FiLogIn, FiUser, FiUsers, FiBriefcase, FiFileText, FiBarChart2, FiSettings, FiBell, FiHome, FiCheckCircle, FiUploadCloud, FiBuilding, FiCheckSquare } from 'react-icons/fi';

/**
 * Sidebar — Legacy sidebar. Replaced by AppShell + ChannelSidebar.
 * Kept for backward compatibility during migration.
 */
export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize user data
  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    };
    loadUser();
  }, []);

  // Define navigation items based on role — derived state, no effect needed
  const navItems = useMemo(() => {
    if (!user) return [];

    const role = user.role;
    const commonItems = [
      {
        name: 'Dashboard',
        href: `/${role.toLowerCase()}/dashboard`,
        icon: FiHome,
        isExternal: false,
      },
    ];

    let roleItems = [];

    if (role === 'EMPLOYEE') {
      roleItems = [
        { name: 'My Tasks', href: '/employee/tasks', icon: FiCheckCircle, isExternal: false },
        { name: 'Meetings', href: '/employee/meetings', icon: FiFileText, isExternal: false },
        { name: 'Notifications', href: '/employee/notifications', icon: FiBell, isExternal: false },
        { name: 'Profile', href: '/employee/profile', icon: FiUser, isExternal: false },
      ];
    } else if (role === 'MANAGER') {
      roleItems = [
        { name: 'Meetings', href: '/manager/meetings', icon: FiFileText, isExternal: false },
        { name: 'Upload Meeting', href: '/manager/meetings/upload', icon: FiUploadCloud, isExternal: false },
        { name: 'Team Tasks', href: '/manager/tasks', icon: FiBriefcase, isExternal: false },
        { name: 'Employees', href: '/manager/employees', icon: FiUsers, isExternal: false },
        { name: 'Analytics', href: '/manager/analytics', icon: FiBarChart2, isExternal: false },
      ];
    } else if (role === 'ADMIN') {
      roleItems = [
        { name: 'Departments', href: '/admin/departments', icon: FiBuilding, isExternal: false },
        { name: 'Users', href: '/admin/users', icon: FiUsers, isExternal: false },
        { name: 'All Tasks', href: '/admin/tasks', icon: FiCheckSquare, isExternal: false },
        { name: 'Analytics', href: '/admin/analytics', icon: FiBarChart2, isExternal: false },
        { name: 'System Logs', href: '/admin/logs', icon: FiFileText, isExternal: false },
        { name: 'Settings', href: '/admin/settings', icon: FiSettings, isExternal: false },
      ];
    }

    return [...commonItems, ...roleItems];
  }, [user]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  if (loading) {
    return (
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-30">
        <div className="flex items-center justify-between p-4">
          <div className="text-xl font-bold text-primary-600 dark:text-primary-400 animate-pulse">
            AI Meeting
          </div>
          <button onClick={toggleSidebar} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            <span className="sr-only">Open sidebar</span>
            <FiMenu className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="mt-4 space-y-2 px-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((item, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded" />
              <div className="text-sm text-gray-500 dark:text-gray-400 w-32">{`Item ${index + 1}`}</div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className={`fixed left-0 top-16 bottom-0 z-30 ${isOpen ? 'w-64' : 'w-16'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300`}>
      <div className="flex h-full flex-col">
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Link href="/" className="flex items-center space-x-3">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              AI Meeting
            </span>
          </Link>
          <button onClick={toggleSidebar} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            {isOpen ? (
              <FiX className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <FiMenu className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* User info */}
        {isOpen && user && (
          <div className="flex items-center space-x-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <img
              src={user.avatar}
              alt={`${user.name}'s avatar`}
              className="w-10 h-10 rounded-full object-cover border-2 border-primary-200"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.role === 'ADMIN' ? 'Admin' : user.role === 'MANAGER' ? 'Manager' : 'Employee'}
              </p>
            </div>
          </div>
        )}

        {/* Navigation menu */}
        <nav className="flex-1 overflow-y-auto">
          <div className="px-3 pt-4">
            {navItems.map((item, index) => (
              <Link
                key={index}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium
                  ${
                    typeof window !== 'undefined' && window.location.pathname === item.href
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
              >
                {item.icon && <item.icon className="h-5 w-5 text-primary-500 dark:text-primary-400" />}
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom section */}
        {isOpen && (
          <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={async () => {
                await authService.logout();
                await authService.clearCurrentUser();
                window.location.href = '/login';
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-md border border-transparent text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <FiLogIn className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
