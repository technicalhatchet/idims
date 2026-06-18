import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DevicesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/cxdashboard/appliances');
  }, [router]);

  return null;
}
