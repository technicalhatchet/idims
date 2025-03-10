import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import TechnicianForm from '@/components/technicians/TechnicianForm';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function NewTechnician() {
  // Only allow admins and managers to create technicians
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  return (
    <>
      <Head>
        <title>New Technician | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <Link href="/technicians" className="text-blue-600 hover:text-blue-800">
            ← Back to Technicians
          </Link>
          <h1 className="text-2xl font-bold mt-4">Create New Technician</h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <TechnicianForm />
        </div>
      </div>
    </>
  );
}

NewTechnician.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default NewTechnician;