import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiLoader } from 'react-icons/fi';

export default function EmployeeMeetingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/workspace?view=meetings');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#eef3f8]">
      <div className="text-center">
        <FiLoader className="mx-auto h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Opening workspace meetings...</p>
      </div>
    </div>
  );
}
