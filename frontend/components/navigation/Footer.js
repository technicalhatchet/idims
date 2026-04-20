import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:flex md:items-center md:justify-between">
          <div className="flex justify-center md:justify-start space-x-6">
            <Link href="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              Privacy Policy
            </Link>
          </div>
          <div className="mt-8 md:mt-0">
            <p className="text-center md:text-right text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} Service Business. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
} 