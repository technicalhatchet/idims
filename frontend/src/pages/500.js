import { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function ServerError() {
  const router = useRouter();
  const { user } = useUser();
  
  // Log error to monitoring service
  useEffect(() => {
    // This would connect to your error monitoring service in production
    console.error('Server error occurred:', window.location.pathname);
    
    // Optionally refresh the page after a timeout
    const timer = setTimeout(() => {
      router.reload();
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <>
      <Head>
        <title>Server Error | Service Business Management</title>
      </Head>
      
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-9xl font-bold text-red-600 dark:text-red-400">500</h1>
          
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-4">
            Server Error
          </h2>
          
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Sorry, something went wrong on our server. Our team has been notified and is working on a fix.
          </p>
          
          <div className="mt-8 space-y-4">
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => router.reload()}
                className="px-6 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              
              <Link 
                href={user ? '/dashboard' : '/'} 
                className="px-6 py-3 text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              >
                Go to {user ? 'Dashboard' : 'Home'}
              </Link>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 pt-4">
              The page will automatically refresh in 10 seconds.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}