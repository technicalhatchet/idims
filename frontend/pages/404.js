import { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function NotFound() {
  const router = useRouter();
  const { user } = useUser();
  
  // Redirect to dashboard after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      const destination = user ? '/dashboard' : '/';
      router.push(destination);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [user, router]);
  
  return (
    <>
      <Head>
        <title>Page Not Found | Service Business Management</title>
      </Head>
      
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-9xl font-bold text-blue-600 dark:text-blue-400">404</h1>
          
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-4">
            Page Not Found
          </h2>
          
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            The page you are looking for doesn't exist or has been moved.
          </p>
          
          <div className="mt-8 space-y-4">
            <Link 
              href={user ? '/dashboard' : '/'} 
              className="px-6 py-3 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors inline-block"
            >
              Go to {user ? 'Dashboard' : 'Home'}
            </Link>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 pt-4">
              You will be redirected automatically in 5 seconds.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}