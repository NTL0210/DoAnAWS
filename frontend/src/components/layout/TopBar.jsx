import Link from 'next/link';
import { useEffect } from 'react';
import { authService } from '../../lib/auth';
import { useState } from 'react';

export default function TopBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    await authService.clearCurrentUser();
    // Redirect to login page
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400 animate-pulse">
              AI Meeting
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
              Workforce
            </span>
          </div>
          <div className="flex items-center space-x-4 animate-pulse">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Not logged in, don't show top bar (shouldn't happen in layout)
  }

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              AI Meeting
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Workforce
            </span>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <img
              src={user.avatar}
              alt={`${user.name}'s avatar`}
              className="w-8 h-8 rounded-full object-cover border-2 border-primary-200"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.role === 'ADMIN' ? 'Admin' : user.role === 'MANAGER' ? 'Manager' : 'Employee'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-transparent bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}