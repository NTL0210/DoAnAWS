import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MeetingsUploadRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/workspace?view=meetings');
  }, [router]);
  return null;
}
