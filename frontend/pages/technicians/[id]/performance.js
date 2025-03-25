// src/pages/technicians/[id]/performance.js
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import TechnicianPerformance from '../../../components/technicians/TechnicianPerformance';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useTechnician, useTechnicianPerformance } from '../../../hooks/useTechnicians';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';

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
  
  return (
    <>
      <Head>
        <title>{`${technician?.user?.first_name} ${technician?.user?.last_name} | Performance | Service Business Management`}</title>
      </Head>
      
      <div className="px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
          <div>
            <div className="flex items-center">
              <Link href={`/technicians/${id}`} className="text-blue-600 hover:text-blue-800 mr-2">
                <span className="text-sm">←</span> Back to Details
              </Link>
            </div>
            <h1 className="text-2xl font-bold mt-2">
              {technician?.user?.first_name} {technician?.user?.last_name} - Performance
            </h1>
          </div>
          
          <div className="mt-4 md:mt-0">
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
        </div>
        
        {performanceError ? (
          <ErrorAlert 
            message="Failed to load performance data" 
            onRetry={refetchPerformance}
          />
        ) : isLoadingPerformance ? (
          <LoadingSpinner />
        ) : (
          <TechnicianPerformance 
            performance={performance} 
            isLoading={isLoadingPerformance} 
          />
        )}
      </div>
    </>
  );
}

TechnicianPerformancePage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default TechnicianPerformancePage;