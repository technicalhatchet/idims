// src/pages/technicians/[id]/index.js
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaEdit, FaUserTimes, FaMapMarkerAlt, FaPhone, FaEnvelope, FaExclamationTriangle } from 'react-icons/fa';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import TechnicianDetails from '../../../components/technicians/TechnicianDetails';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { useTechnician, useTechnicianMutations } from '../../../hooks/useTechnicians';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';

function TechnicianDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  // Fetch technician details
  const { 
    data: technician, 
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
              <FaUserTimes className="mr-2" />
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

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default TechnicianDetail;