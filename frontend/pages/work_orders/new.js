import Head from 'next/head';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import WorkOrderForm from '@/components/work-orders/WorkOrderForm';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

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
          <h1 className="text-2xl font-bold">Create New Work Order</h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <WorkOrderForm />
        </div>
      </div>
    </>
  );
}

NewWorkOrder.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default NewWorkOrder;