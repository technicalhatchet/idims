// src/pages/technicians/[id]/index.js
import { useState } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaEdit, FaUserTimes, FaMapMarkerAlt, FaPhone, FaEnvelope, FaExclamationTriangle } from 'react-icons/fa';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import TechnicianDetails from '../../../components/technicians/TechnicianDetails';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import DeleteModal from '../../../components/ui/DeleteModal';
import { useTechnician, useTechnicianMutations } from '../../../hooks/useTechnicians';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';
import React from 'react';

function TechnicianDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  useAuthRedirect();
  
  const {
    data: technician,
    isLoading,
    error,
    refetch
  } = useTechnician(id);

  // Add debug logging to see the technician data
  React.useEffect(() => {
    if (technician) {
      console.log('[TECHNICIAN PAGE] Technician data received:', technician);
      console.log('[TECHNICIAN PAGE] User data exists:', !!technician.user);
      if (technician.user) {
        console.log('[TECHNICIAN PAGE] User data:', technician.user);
      } else {
        console.warn('[TECHNICIAN PAGE] Missing user data for technician:', technician.employee_id);
      }
    }
  }, [technician]);
  
  const mutations = useTechnicianMutations();
  
  const handleDelete = async () => {
    try {
      console.log('Deleting technician with ID:', id);
      await mutations.delete(id);
      router.push('/technicians');
    } catch (error) {
      console.error('Failed to delete technician:', error);
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

  if (!technician) {
    return (
      <div className="px-4 py-6">
        <ErrorAlert 
          message="Technician not found" 
          onRetry={refetch}
        />
      </div>
    );
  }

  // Handle missing user data but still show technician details
  const hasUserData = !!technician.user;

  return (
    <>
      <Head>
        <title>{hasUserData 
          ? `${technician.user.first_name} ${technician.user.last_name} | Service Business Management`
          : `Technician ${technician.employee_id} | Service Business Management`
        }</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Technician Details</h1>
            <p className="text-gray-600">
              {hasUserData
                ? `${technician.user.first_name} ${technician.user.last_name}`
                : `${technician.employee_id} (User data unavailable)`
              }
            </p>
          </div>
          <div className="flex space-x-2 mt-4 sm:mt-0">
            <Link
              href={`/technicians/${id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Edit Technician
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete Technician
            </button>
          </div>
        </div>

        <TechnicianDetails technician={technician} />

        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Technician"
          message="Are you sure you want to delete this technician? This action cannot be undone."
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
export default function TechnicianDetailWithLayout(props) {
  return (
    <DashboardLayout>
      <TechnicianDetail {...props} />
    </DashboardLayout>
  );
}