import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import TechnicianSchedule from '../../../components/technicians/TechnicianSchedule';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useTechnician, useTechnicianSchedule } from '../../../hooks/useTechnicians';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';

function TechnicianSchedulePage() {
  const router = useRouter();
  const { id } = router.query;
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().setDate(new Date().getDate() + 7)));
  
  useAuthRedirect();
  
  const {
    data: technician,
    isLoading,
    error,
    refetch
  } = useTechnician(id);
  
  const {
    data: schedule,
    isLoading: isLoadingSchedule,
    error: scheduleError,
    refetch: refetchSchedule
  } = useTechnicianSchedule(id, startDate, endDate);
  
  const handleDateRangeChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
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
        <title>{`${technician?.user?.first_name} ${technician?.user?.last_name} | Schedule | Service Business Management`}</title>
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
              {technician?.user?.first_name} {technician?.user?.last_name} - Schedule
            </h1>
          </div>
          
          <div className="mt-4 md:mt-0">
            {/* Date range selector would go here */}
          </div>
        </div>
        
        {scheduleError ? (
          <ErrorAlert 
            message="Failed to load technician schedule" 
            onRetry={refetchSchedule}
          />
        ) : isLoadingSchedule ? (
          <LoadingSpinner />
        ) : (
          <TechnicianSchedule 
            schedule={schedule} 
            isLoading={isLoadingSchedule} 
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
          />
        )}
      </div>
    </>
  );
}

TechnicianSchedulePage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default TechnicianSchedulePage;