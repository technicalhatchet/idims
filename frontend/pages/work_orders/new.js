import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import WorkOrderForm from '../../components/work_orders/WorkOrderForm';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

function NewWorkOrder() {
  // Only allow admins and managers to create work orders
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  return (
    <>
      <Head>
        <title>New Work Order | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Work Order</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <WorkOrderForm />
        </div>
      </div>
    </>
  );
}

NewWorkOrder.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

// Server-side authentication and role check
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
  
  // Additional role-based check could be added here if needed
  // For now, we're using the client-side useAuthRedirect hook
  
  return {
    props: {},
  };
}

export default NewWorkOrder;