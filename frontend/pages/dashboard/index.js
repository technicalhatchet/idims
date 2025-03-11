import { useState, useEffect } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaChartLine, FaClipboardList, FaCalendarAlt, FaFileInvoiceDollar, FaUsers, FaCog } from 'react-icons/fa';

import DashboardLayout from '@/components/layouts/DashboardLayout';
import StatsOverview from '@/components/dashboard/StatsOverview';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { apiClient } from '@/utils/fetchWithAuth';

function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  
  // Use auth redirect hook for protection
  const { user } = useAuthRedirect();
  
  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch dashboard stats
        const data = await apiClient('/api/dashboard/stats');
        setDashboardData(data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchDashboardData();
    }
  }, [user]);
  
  const quickActions = [
    {
      title: 'New Work Order',
      href: '/work-orders/new',
      icon: <FaClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
      color: 'bg-blue-100 dark:bg-blue-900',
      roles: ['admin', 'manager', 'technician']
    },
    {
      title: 'Schedule Job',
      href: '/schedule',
      icon: <FaCalendarAlt className="h-6 w-6 text-green-600 dark:text-green-400" />,
      color: 'bg-green-100 dark:bg-green-900',
      roles: ['admin', 'manager', 'technician']
    },
    {
      title: 'Create Invoice',
      href: '/invoices/new',
      icon: <FaFileInvoiceDollar className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
      color: 'bg-indigo-100 dark:bg-indigo-900',
      roles: ['admin', 'manager']
    },
    {
      title: 'Add Client',
      href: '/clients/new',
      icon: <FaUsers className="h-6 w-6 text-purple-600 dark:text-purple-400" />,
      color: 'bg-purple-100 dark:bg-purple-900',
      roles: ['admin', 'manager']
    },
    {
      title: 'Reports',
      href: '/reports',
      icon: <FaChartLine className="h-6 w-6 text-red-600 dark:text-red-400" />,
      color: 'bg-red-100 dark:bg-red-900',
      roles: ['admin', 'manager']
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: <FaCog className="h-6 w-6 text-gray-600 dark:text-gray-400" />,
      color: 'bg-gray-100 dark:bg-gray-700',
      roles: ['admin', 'manager', 'technician', 'client']
    }
  ];
  
  // Filter quick actions based on user role
  const filteredActions = user 
    ? quickActions.filter(action => {
        const userRole = user['https://servicebusiness.com/roles']?.[0] || 'client';
        return action.roles.includes(userRole);
      })
    : [];
  
  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <ErrorAlert 
          message={error} 
          onRetry={() => router.reload()}
        />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back, {user?.name || 'User'}
          </p>
        </div>
        
        {/* Stats Overview */}
        {dashboardData && (
          <StatsOverview stats={dashboardData.stats} />
        )}
        
        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className={`p-3 rounded-lg ${action.color} mr-4`}>
                  {action.icon}
                </div>
                <span className="font-medium">{action.title}</span>
              </Link>
            ))}
          </div>
        </div>
        
        {/* Recent Activity */}
        {dashboardData?.recentActivity && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {dashboardData.recentActivity.map((activity) => (
                  <li key={activity.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.timestamp}</p>
                      </div>
                      {activity.link && (
                        <Link href={activity.link.href} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                          {activity.link.text}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <Link href="/activity" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View all activity
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* Today's Schedule (for technicians and managers) */}
        {user && ['admin', 'manager', 'technician'].includes(user['https://servicebusiness.com/roles']?.[0]) && dashboardData?.todaysSchedule && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Today's Schedule</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {dashboardData.todaysSchedule.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <p>No appointments scheduled for today.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {dashboardData.todaysSchedule.map((appointment) => (
                    <li key={appointment.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {appointment.time} - {appointment.client}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {appointment.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {appointment.address}
                          </p>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            appointment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            appointment.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {appointment.status.replace('_', ' ')}
                          </span>
                          <Link href={`/work-orders/${appointment.id}`} className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
                            View
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <Link href="/schedule" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View full schedule
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

Dashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default Dashboard;