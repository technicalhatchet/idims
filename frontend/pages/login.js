import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  useEffect(() => {
    router.push('/api/auth/login');
  }, []);
  return null;
}