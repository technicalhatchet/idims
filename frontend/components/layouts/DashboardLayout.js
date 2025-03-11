import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { 
  FaTachometerAlt, FaClipboardList, FaCalendarAlt, FaFileInvoiceDollar, 
  FaUsers, FaWrench, FaCog, FaBars, FaTimes, FaSignOutAlt, FaMoon, FaSun
} from 'react-icons/fa';

import NotificationsDropdown from '../notifications/NotificationsDropdown';
import UserDropdown from '../user/UserDropdown';
import { useTheme } from '../../context/ThemeContext';
import ErrorBoundary from '../../context/ErrorBoundary';

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Close sidebar on route change on mobile
    const handleRouteChange = () => {
      setSidebarOpen(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  // Handle auth redirects
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/api/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">{error.message}</p>
          <button
            onClick={() => router.push('/api/auth/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  // Get navigation items based on user role
  const getNavItems = () => {
    const items = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: <FaTachometerAlt className="mr-3" />,
        roles: ['admin', 'manager', 'technician', 'client'],
      },
      {
        name: 'Work Orders',
        href: '/work-orders',
        icon: <FaClipboardList className="mr-3" />,
        roles: ['admin', 'manager', 'technician', 'client'],
      },
      {
        name: 'Schedule',
        href: '/schedule',
        icon: <FaCalendarAlt className="mr-3" />,
        roles: ['admin', 'manager', 'technician'],
      },
      {
        name: 'Invoices',
        href: '/invoices',
        icon: <FaFileInvoiceDollar className="mr-3" />,
        roles: ['admin', 'manager', 'client'],
      },
      {
        name: 'Clients',
        href: '/clients',
        icon: <FaUsers className="mr-3" />,
        roles: ['admin', 'manager'],
      },
      {
        name: 'Technicians',
        href: '/technicians',
        icon: <FaWrench className="mr-3" />,
        roles: ['admin', 'manager'],
      },
      {
        name: 'Settings',
        href: '/settings',
        icon: <FaCog className="mr-3" />,
        roles: ['admin', 'manager', 'technician', 'client'],
      },
    ];

    // Get user role from Auth0 metadata
    const userRole = user['https://servicebusiness.com/roles']?.[0] || 'client';

    // Filter items by role
    return items.filter(item => item.roles.includes(userRole));
  };

  const navItems = getNavItems();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-lg transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <Link href="/dashboard" className="flex items-center">
            <img
              src="/logo.svg"
              alt="Service Business Logo"
              className="h-8 w-auto"
            />
            <span className="ml-2 text-xl font-semibold text-gray-800 dark:text-white">Service Biz</span>
          </Link>
          <button
            className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <FaTimes />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                router.pathname.startsWith(item.href)
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t dark:border-gray-700 p-4">
          <Link
            href="/api/auth/logout"
            className="flex items-center text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            <FaSignOutAlt className="mr-3" />
            Log Out
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64">
        {/* Topbar */}
        <header className="bg-white dark:bg-gray-800 shadow z-10">
          <div className="h-16 px-4 flex items-center justify-between">
            <button
              className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <FaBars />
            </button>

            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <FaSun className="text-yellow-400" />
                ) : (
                  <FaMoon className="text-gray-500" />
                )}
              </button>

              <ErrorBoundary>
                {/* Add a placeholder when component is not available */}
                {typeof NotificationsDropdown === 'function' ? (
                  <NotificationsDropdown />
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center">
                    <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                  </div>
                )}
              </ErrorBoundary>

              <ErrorBoundary>
                {/* Add a placeholder when component is not available */}
                {typeof UserDropdown === 'function' ? (
                  <UserDropdown user={user} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 text-sm font-bold">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}