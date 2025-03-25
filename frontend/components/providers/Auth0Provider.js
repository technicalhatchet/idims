'use client';

import { useUser } from '@auth0/nextjs-auth0';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Auth0Provider({ children }) {
  const { user, error, isLoading } = useUser();
  const router = useRouter();

  // List of public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/api/auth/login',
    '/api/auth/callback',
    '/about',
    '/services',
    '/contact'
  ];
  const isPublicRoute = publicRoutes.includes(router.pathname);

  useEffect(() => {
    // Only redirect to login if we're not on a public route and there's an error
    if (error && !isPublicRoute) {
      router.push('/login');
    }
  }, [error, router, isPublicRoute]);

  // For public routes, always render children
  if (isPublicRoute) {
    return children;
  }

  // For protected routes, show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // For protected routes, show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <a
            href="/api/auth/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Log in
          </a>
        </div>
      </div>
    );
  }

  return children;
} 