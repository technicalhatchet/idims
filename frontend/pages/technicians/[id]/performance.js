// src/pages/technicians/[id]/performance.js
import { useState } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import TechnicianPerformance from '../../../components/technicians/TechnicianPerformance';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useTechnician, useTechnicianPerformance } from '../../../hooks/useTechnicians';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';

function TechnicianPerformancePage() {
  const router = useRouter();
  const { id } = router.query;
  const [period, setPeriod] = useState('month');
  
  useAuthRedirect();
  
  const {
    data: technician,
    isLoading,
    error,
    refetch
  } = useTechnician(id);
  
  const {
    data: performance,
    isLoading: isLoadingPerformance,
    error: performanceError,
    refetch: refetchPerformance
  } = useTechnicianPerformance(id, period);
  
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };
  
  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="px-4 py-6">
        <ErrorAlert 
          message="Failed to load technician details" 
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!technician || !technician.user) {
    return (
      <div className="px-4 py-6">
        <ErrorAlert 
          message="Technician not found" 
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`Performance - ${technician.user.first_name} ${technician.user.last_name} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Technician Performance</h1>
            <p className="text-gray-600">
              {technician.user.first_name} {technician.user.last_name}
            </p>
          </div>
          <div className="flex space-x-2 mt-4 sm:mt-0">
            <Link
              href={`/technicians/${id}`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Back to Technician
            </Link>
          </div>
        </div>

        {performanceError && (
          <ErrorAlert
            message="Failed to load performance data"
            onRetry={refetchPerformance}
          />
        )}

        {isLoadingPerformance ? (
          <LoadingSpinner />
        ) : (
          <TechnicianPerformance
            technician={technician}
            performance={performance}
            period={period}
            onPeriodChange={handlePeriodChange}
          />
        )}
      </div>
    </>
  );
}

// Add server-side props with auth
export async function getServerSideProps(context) {
  // Check authentication
  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }
  
  // Return empty props as data fetching happens on the client
  return {
    props: {},
  };
}

// Export the component with layout
export default function TechnicianPerformanceWithLayout(props) {
  return (
    <DashboardLayout>
      <TechnicianPerformancePage {...props} />
    </DashboardLayout>
  );
}