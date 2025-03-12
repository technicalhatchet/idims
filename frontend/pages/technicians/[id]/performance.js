// src/pages/technicians/[id]/performance.js
import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import TechnicianPerformance from '@/components/technicians/TechnicianPerformance';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useTechnician, useTechnicianPerformance } from '@/hooks/useTechnicians';

function TechnicianPerformancePage() {
  const router = useRouter();
  const { id } = router.query;
  const [period, setPeriod] = useState('month');
  
  // Fetch technician details
  const { 
    data: technician, 
    isLoading: isLoadingTechnician,
    error: technicianError
  } = useTechnician(id);

  // Fetch performance data
  const { 
    data: performance, 
    isLoading: isLoadingPerformance,
    error: performanceError,
    refetch
  } = useTechnicianPerformance(id, period);

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
  };

  if (isLoadingTechnician) {
    return (
      <div className="px-4 py-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (technicianError) {
    return (
      <div className="px-4 py-6">
        <ErrorAlert 
          message="Failed to load technician details" 
        />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`${technician?.user?.first_name} ${technician?.user?.last_name} Performance | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/technicians/${id}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Technician
          </Link>
          <div className="flex items-center justify-between mt-4">
            <h1 className="text-2xl font-bold">
              {technician?.user?.first_name} {technician?.user?.last_name} - Performance
            </h1>
            
            <div>
              <select
                value={period}
                onChange={handlePeriodChange}
                className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          </div>
        </div>
        
        {performanceError ? (
          <ErrorAlert 
            message="Failed to load performance data" 
            onRetry={refetch}
          />
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