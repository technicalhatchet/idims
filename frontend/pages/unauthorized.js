import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaLock, FaArrowLeft } from 'react-icons/fa';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserRole } from '../utils/auth0-helpers';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { returnTo } = router.query;
  
  // If user is not logged in, redirect to login
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/api/auth/login');
    }
  }, [user, isLoading, router]);
  
  // Get user role if available
  const role = user ? getUserRole(user) : null;
  
  return (
    <>
      <Head>
        <title>Access Denied | Service Business Management</title>
      </Head>
      
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-red-100">
              <FaLock className="h-12 w-12 text-red-600" aria-hidden="true" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Access Denied
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              You don't have permission to access this resource.
            </p>
            {role && (
              <p className="mt-1 text-center text-sm text-gray-500">
                Your current role is: <span className="font-medium">{role}</span>
              </p>
            )}
          </div>
          
          <div className="flex flex-col space-y-4">
            {returnTo ? (
              <Link 
                href={returnTo}
                className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FaArrowLeft className="mr-2" />
                Go Back
              </Link>
            ) : (
              <Link 
                href="/dashboard"
                className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FaArrowLeft className="mr-2" />
                Go to Dashboard
              </Link>
            )}
            
            <Link 
              href="/api/auth/logout"
              className="flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign Out
            </Link>
          </div>
          
          <div className="text-center text-xs text-gray-500 mt-8">
            <p>
              If you believe this is an error, please contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}