import { useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';
import { getUserRole } from '../utils/auth0-helpers';

/**
 * Auth Router - Redirects users to the appropriate dashboard based on their role
 * This page is hit after Auth0 login callback
 */
export default function AuthRouter() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // Not logged in, redirect to login
      router.replace('/api/auth/login');
      return;
    }

    const role = getUserRole(user);
    console.log('[AuthRouter] User role:', role);

    // Redirect based on role
    switch (role) {
      case 'admin':
      case 'manager':
      case 'technician':
        router.replace('/techboard');
        break;
      case 'client':
        router.replace('/cxdashboard');
        break;
      case 'diyer':
        router.replace('/solomon');
        break;
      default:
        router.replace('/cxdashboard');
        break;
    }
  }, [user, isLoading, router]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0A0F1E' }}
    >
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-cyan-400 text-sm font-medium tracking-wide">ROUTING...</p>
      </div>
    </div>
  );
}
