import Head from 'next/head';
import Link from 'next/link';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import TechnicianForm from '../../components/technicians/TechnicianForm';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import { withPageAuthRequired } from '../../utils/auth0-helpers';

function NewTechnician() {
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  return (
    <>
      <Head>
        <title>Add New Technician | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Add New Technician</h1>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <TechnicianForm isEdit={false} />
        </div>
      </div>
    </>
  );
}

NewTechnician.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default NewTechnician;