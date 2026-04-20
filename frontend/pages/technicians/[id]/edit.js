import { useState } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import TechnicianForm from '../../../components/technicians/TechnicianForm';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useTechnician, useTechnicianMutations } from '../../../hooks/useTechnicians';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';

function EditTechnician() {
  const router = useRouter();
  const { id } = router.query;
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useAuthRedirect();
  
  const {
    data: technician,
    isLoading,
    error,
    refetch
  } = useTechnician(id);
  
  const { updateTechnician } = useTechnicianMutations();
  
  const handleSubmit = async (formData) => {
    try {
      setIsSubmitting(true);
      await updateTechnician.mutateAsync({ id, data: formData });
      router.push(`/technicians/${id}`);
    } catch (error) {
      console.error('Failed to update technician:', error);
    } finally {
      setIsSubmitting(false);
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

  // Ensure user data exists, even if empty
  const displayName = technician.user ? 
    `${technician.user.first_name || ''} ${technician.user.last_name || ''}`.trim() :
    technician.employee_id || 'Technician';

  return (
    <>
      <Head>
        <title>{`Edit ${displayName} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Edit Technician</h1>
            <p className="text-gray-600 dark:text-gray-300">
              {displayName} 
              {!technician.user && <span className="ml-2 text-amber-600 dark:text-amber-400">(User data unavailable)</span>}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <Link
              href={`/technicians/${id}`}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </Link>
          </div>
        </div>

        <TechnicianForm
          technician={technician}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
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
export default function EditTechnicianWithLayout(props) {
  return (
    <DashboardLayout>
      <EditTechnician {...props} />
    </DashboardLayout>
  );
}