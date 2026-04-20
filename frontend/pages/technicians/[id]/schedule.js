import { useState } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import TechnicianSchedule from '../../../components/technicians/TechnicianSchedule';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useTechnician, useTechnicianSchedule } from '../../../hooks/useTechnicians';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';

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
        <title>{`Schedule - ${technician.user.first_name} ${technician.user.last_name} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Technician Schedule</h1>
            <p className="text-gray-600 dark:text-gray-300">
              {technician.user.first_name} {technician.user.last_name}
            </p>
          </div>
          <div className="flex space-x-2 mt-4 sm:mt-0">
            <Link
              href={`/technicians/${id}`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Back to Technician
            </Link>
          </div>
        </div>

        {scheduleError && (
          <ErrorAlert
            message="Failed to load schedule data"
            onRetry={refetchSchedule}
          />
        )}

        <TechnicianSchedule
          technician={technician}
          technicianId={technician.id}
          schedule={schedule}
          isLoadingSchedule={isLoadingSchedule}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={handleDateRangeChange}
        />
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
export default function TechnicianScheduleWithLayout(props) {
  return (
    <DashboardLayout>
      <TechnicianSchedulePage {...props} />
    </DashboardLayout>
  );
}