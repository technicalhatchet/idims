import { useState } from 'react';
import Head from 'next/head';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import TechnicianFieldPerformance from '../../components/technicians/TechnicianFieldPerformance';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useTechnicianMyPerformance } from '../../hooks/useTechnicians';

function TechDashboardPerformancePage() {
  const [period, setPeriod] = useState('month');
  const {
    data: performance,
    isLoading,
    error,
    refetch,
  } = useTechnicianMyPerformance(period);

  return (
    <>
      <Head>
        <title>My Performance | Field Tech Dashboard</title>
      </Head>

      <div className="px-4 py-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90 mb-1">Field metrics</p>
          <h1 className="text-2xl font-bold text-white">My Performance</h1>
          {performance?.technician_name && (
            <p className="text-sm text-gray-400 mt-1">{performance.technician_name}</p>
          )}
        </div>

        {error && (
          <ErrorAlert message="Failed to load performance data" onRetry={refetch} />
        )}

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <TechnicianFieldPerformance
            performance={performance}
            period={period}
            onPeriodChange={setPeriod}
            variant="mobile"
          />
        )}
      </div>
    </>
  );
}

TechDashboardPerformancePage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default TechDashboardPerformancePage;
