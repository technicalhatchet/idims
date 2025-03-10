import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import TechnicianForm from '@/components/technicians/TechnicianForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import { useTechnician } from '@/hooks/useTechnicians';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function EditTechnician() {
  const router = useRouter();
  const { id } = router.query;
  
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  // Fetch technician details
  const { 
    data: technician, 
    isLoading,
    error,
    refetch
  } = useTechnician(id);

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
        <title>{`Edit ${technician?.user?.first_name} ${technician?.user?.last_name} | Technician | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <Link href={`/technicians/${id}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Technician
          </Link>
          <h1 className="text-2xl font-bold mt-4">
            Edit Technician: {technician?.user?.first_name} {technician?.user?.last_name}
          </h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <TechnicianForm initialData={technician} isEdit={true} />
        </div>
      </div>
    </>
  );
}

EditTechnician.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default EditTechnician;