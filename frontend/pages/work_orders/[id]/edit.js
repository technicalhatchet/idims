import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import WorkOrderForm from '../../../components/work_orders/WorkOrderForm';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useWorkOrder } from '../../../hooks/useWorkOrders';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';

function EditWorkOrder({ id }) {
  const router = useRouter();
  const { data: workOrder, isLoading: isLoadingWorkOrder, error } = useWorkOrder(id);
  
  // Restrict access to admins only
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  if (isLoadingWorkOrder) {
    return (
      <div className="p-8 flex justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorAlert 
          message="Failed to load work order" 
          onRetry={() => router.reload()}
        />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Edit Work Order | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Work Order</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Order Number: {workOrder?.order_number}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <WorkOrderForm initialData={workOrder} isEdit={true} />
        </div>
      </div>
    </>
  );
}

EditWorkOrder.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

// Server-side authentication and role check
export async function getServerSideProps(context) {
  // Get the ID from the URL
  const { id } = context.params;
  
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
  
  // Server-side role check (optional, as we also have client-side check)
  // Get user roles from session
  const roles = session.user?.['https://idimsapi/roles'] || [];
  const isAdmin = roles.includes('admin') || roles.includes('manager');
  
  if (!isAdmin) {
    return {
      redirect: {
        destination: '/unauthorized',
        permanent: false,
      },
    };
  }
  
  return {
    props: {
      id,
    },
  };
}

export default EditWorkOrder; 