import { useState, useEffect } from 'react';
import Head from 'next/head';
import { FaUser, FaFileAlt, FaTools, FaMoneyBillWave } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useUser } from '@auth0/nextjs-auth0/client';
import { withPageAuthRequired, getStaticPropsWithFallback } from '../../utils/auth0-helpers';
import apiClient, { ErrorTypes } from '../../utils/api-client';

function Dashboard() {
  const { user, isLoading, error } = useUser();
  const [dashboardData, setDashboardData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [errorType, setErrorType] = useState(null);

  useEffect(() => {
    // Fetch dashboard data
    const fetchDashboardData = async () => {
      try {
        setDataLoading(true);
        let data;
        
        // First try to fetch from the real backend
        try {
          console.log('Attempting to fetch data from backend API...');
          // Use our apiClient utility to handle auth token and error handling
          data = await apiClient.get('dashboard/stats');
          console.log('Successfully fetched backend data:', data);
          setUsingMockData(false);
          setErrorType(null);
        } catch (backendError) {
          // Determine the type of error
          const errorType = backendError.type || ErrorTypes.UNKNOWN;
          setErrorType(errorType);
          
          // Log appropriate error message based on type
          switch(errorType) {
            case ErrorTypes.CORS:
              console.warn('CORS error detected - backend may be running but CORS is not configured properly');
              break;
            case ErrorTypes.NETWORK:
              console.warn('Network error - backend may not be running');
              break;
            case ErrorTypes.AUTH:
              console.warn('Authentication error - you may not be properly authenticated');
              break;
            default:
              console.error('Backend API error, falling back to mock data:', backendError);
              // Show the error details in the console for debugging
              console.debug('Error details:', {
                message: backendError.message,
                status: backendError.status,
                details: backendError.details,
                type: backendError.type,
                stack: backendError.stack
              });
          }
          
          // If backend fails, fall back to mock API
          console.log('Falling back to Next.js API route...');
          const response = await fetch('/api/dashboard');
          if (!response.ok) throw new Error('Failed to fetch dashboard data');
          data = await response.json();
          console.log('Successfully fetched mock data:', data);
          setUsingMockData(true);
        }
        
        setDashboardData(data);
        setDataError(null);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setDataError(err.message || 'Unknown error occurred');
        setErrorType(err.type || ErrorTypes.UNKNOWN);
      } finally {
        setDataLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorAlert message={error.message} />;
  }

  const getErrorMessage = () => {
    switch(errorType) {
      case ErrorTypes.CORS:
        return 'Unable to connect to API due to CORS restrictions. Check if the backend is properly configured.';
      case ErrorTypes.NETWORK:
        return 'Unable to connect to API. The server might be offline or unreachable.';
      case ErrorTypes.AUTH:
        return 'Authentication error. You may not have permission to access this data.';
      case ErrorTypes.SERVER:
        return 'The server encountered an error while processing your request.';
      default:
        return dataError || 'An unknown error occurred while fetching data.';
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard | Service Business Management</title>
      </Head>

      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        
        {dataLoading ? (
          <LoadingSpinner />
        ) : dataError ? (
          <ErrorAlert message={getErrorMessage()} />
        ) : (
          <>
            {usingMockData && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800">
                ⚠️ Using mock data - {errorType ? getErrorMessage() : 'Backend connection failed. Check console for details.'}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Simple Stats Cards */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg mr-4">
                    <FaUser className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Clients</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {usingMockData
                        ? dashboardData?.clientCount || 0
                        : dashboardData?.clients?.active || 0}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg mr-4">
                    <FaFileAlt className="text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Open Quotes</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboardData?.openQuotesCount || 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg mr-4">
                    <FaTools className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Work Orders</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {usingMockData
                        ? dashboardData?.workOrdersCount || 0
                        : dashboardData?.work_orders?.pending || 0}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg mr-4">
                    <FaMoneyBillWave className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue (MTD)</h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">$
                      {usingMockData
                        ? dashboardData?.revenueMonth?.toLocaleString() || 0
                        : dashboardData?.revenue?.this_month?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Work Orders</h2>
                <div className="divide-y dark:divide-gray-700">
                  {(dashboardData?.recentWorkOrders || []).length > 0 ? (
                    dashboardData.recentWorkOrders.map((order) => (
                      <div key={order.id} className="py-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">{order.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{order.client}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            order.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent work orders</p>
                  )}
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Upcoming Appointments</h2>
                <div className="divide-y dark:divide-gray-700">
                  {(dashboardData?.upcomingAppointments || []).length > 0 ? (
                    dashboardData.upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} className="py-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">{appointment.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.date}, {appointment.time}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.client}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No upcoming appointments</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

Dashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

// Add getStaticProps to avoid build errors
export const getStaticProps = getStaticPropsWithFallback;

export default withPageAuthRequired(Dashboard);