import { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import { FaLock, FaHome, FaSignOutAlt } from 'react-icons/fa';

export default function Unauthorized() {
  const router = useRouter();
  const { user } = useUser();
  
  // Get role from Auth0 user metadata
  const userRole = user ? (user['https://servicebusiness.com/roles']?.[0] || 'client') : null;
  
  return (
    <>
      <Head>
        <title>Unauthorized Access | Service Business Management</title>
      </Head>
      
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="bg-red-600 p-4 flex justify-center">
            <div className="rounded-full bg-white p-3">
              <FaLock className="h-8 w-8 text-red-600" />
            </div>
          </div>
          
          <div className="p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Unauthorized Access
            </h1>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You don't have permission to access this page.
              {userRole && (
                <span> Your current role is <strong>{userRole}</strong>.</span>
              )}
            </p>
            
            <div className="space-y-3">
              {user && (
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors w-full"
                >
                  <FaHome className="mr-2" />
                  Go to Dashboard
                </Link>
              )}
              
              <Link
                href="/"
                className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full"
              >
                <FaHome className="mr-2" />
                Go to Home Page
              </Link>
              
              {user && (
                <Link
                  href="/api/auth/logout"
                  className="flex items-center justify-center px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900 transition-colors w-full"
                >
                  <FaSignOutAlt className="mr-2" />
                  Sign Out
                </Link>
              )}
            </div>
            
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              If you believe this is an error, please contact support.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}