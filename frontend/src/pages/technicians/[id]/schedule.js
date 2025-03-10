import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import TechnicianWorkload from '@/components/technicians/TechnicianWorkload';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import { useTechnician, useTechnicianWorkload } from '@/hooks/useTechnicians';

function TechnicianSchedulePage() {
  const router = useRouter();
  const { id } = router.query;
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().setDate(new Date().getDate() + 14))); // Two weeks
  
  // Fetch technician details
  const { 
    data: technician, 
    isLoading: isLoadingTechnician,
    error: technicianError
  } = useTechnician(id);

  // Fetch workload/schedule data
  const { 
    data: workload, 
    isLoading: isLoadingWorkload,
    error: workloadError,
    refetch
  } = useTechnicianWorkload(id, startDate, endDate);

  const handleDateRangeChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
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
        <title>{`${technician?.user?.first_name} ${technician?.user?.last_name} Schedule | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/technicians/${id}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Technician
          </Link>
          <div className="flex items-center mt-4">
            <h1 className="text-2xl font-bold">
              {technician?.user?.first_name} {technician?.user?.last_name} - Schedule
            </h1>
          </div>
        </div>
        
        {/* Date range selector */}
        <div className="mb-6 flex">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={startDate.toISOString().slice(0, 10)}
                onChange={(e) => handleDateRangeChange(new Date(e.target.value), endDate)}
                className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={endDate.toISOString().slice(0, 10)}
                onChange={(e) => handleDateRangeChange(startDate, new Date(e.target.value))}
                className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
        
        {workloadError ? (
          <ErrorAlert 
            message="Failed to load schedule data" 
            onRetry={refetch}
          />
        ) : (
          <TechnicianWorkload 
            workload={workload} 
            isLoading={isLoadingWorkload} 
          />
        )}
      </div>
    </>
  );
}

TechnicianSchedulePage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default TechnicianSchedulePage;, 
    isLoading,
    error,
    refetch
  } = useTechnician(id);

  // Delete technician mutation
  const { deleteTechnician, isLoading: isDeleting } = useTechnicianMutations();

  const handleDelete = async () => {
    try {
      await deleteTechnician(id);
      router.push('/technicians');
    } catch (error) {
      console.error('Error deleting technician:', error);
    }
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
        <title>{`${technician?.user?.first_name} ${technician?.user?.last_name} | Technician | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
          <div>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold">
                {technician?.user?.first_name} {technician?.user?.last_name}
              </h1>
            </div>
            <p className="text-gray-500 mt-1">Technician ID: {technician?.employee_id}</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex space-x-2">
            <Link 
              href={`/technicians/${id}/schedule`}
              className="btn-outline flex items-center"
            >
              View Schedule
            </Link>
            <Link 
              href={`/technicians/${id}/performance`}
              className="btn-outline flex items-center"
            >
              View Performance
            </Link>
            <Link 
              href={`/technicians/${id}/edit`} 
              className="btn-primary flex items-center"
            >
              <FaEdit className="mr-2" />
              Edit
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn-danger flex items-center"
            >
              <FaTimes className="mr-2" />
              Delete
            </button>
          </div>
        </div>
        
        {/* Technician Details */}
        <TechnicianDetails technician={technician} />
        
        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Technician"
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="mr-3"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={isDeleting}
                disabled={isDeleting}
              >
                Delete
              </Button>
            </>
          }
        >
          <div className="flex items-start">
            <div className="mr-3 flex-shrink-0">
              <FaExclamationTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this technician?
                <strong> {technician?.user?.first_name} {technician?.user?.last_name}</strong>
              </p>
              <p className="text-sm text-red-600 mt-2">
                This action cannot be undone. All associated data will be permanently removed.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}

TechnicianDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default TechnicianDetail;