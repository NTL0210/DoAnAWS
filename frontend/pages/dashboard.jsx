import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiLoader } from 'react-icons/fi';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function DashboardRedirect() {
  const router = useRouter();
  const { currentUser, loading, userRole } = useWorkspace();

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    router.replace(getDashboardPath(userRole || currentUser?.role));
  }, [currentUser, loading, router, userRole]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#eef3f8]">
      <div className="text-center">
        <FiLoader className="mx-auto h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Opening your dashboard...</p>
      </div>
    </div>
  );
}

function getDashboardPath(role) {
  if (role === 'EMPLOYEE') return '/employee/dashboard';
  if (role === 'MANAGER') return '/manager/dashboard';
  return '/admin/dashboard';
}
