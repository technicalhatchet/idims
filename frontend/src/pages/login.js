import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { FaSignInAlt } from 'react-icons/fa';
import HomeLayout from '@/components/layouts/HomeLayout';

export default function Login() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  
  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // If user is already authenticated, don't show content (will redirect)
  if (user) {
    return null;
  }
  
  return (
    <>
      <Head>
        <title>Sign In | Service Business Management</title>
      </Head>
      
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-200px)]">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Sign In to Your Account
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Access your service business dashboard
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow rounded-lg">
            <div className="space-y-6">
              <div>
                <Link
                  href="/api/auth/login"
                  className="w-full flex justify-center items-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <FaSignInAlt className="mr-2" />
                  Sign In with Auth0
                </Link>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or</span>
                </div>
              </div>
              
              <div>
                <Link
                  href="/"
                  className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Return to Home Page
                </Link>
              </div>
            </div>
            
            <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>
                Don't have an account?{' '}
                <Link href="/contact" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
                  Contact us to get started
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Use the home layout
Login.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};