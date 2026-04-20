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
import { useTheme } from '../../../context/ThemeContext';

function EditWorkOrder({ id }) {
  const router = useRouter();
  const { data: workOrder, isLoading: isLoadingWorkOrder, error, refetch } = useWorkOrder(id);
  const { theme } = useTheme();
  
  // Restrict access to admins only
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  // Ensure dark mode applies correctly on page load
  useEffect(() => {
    // Apply the theme from context to the document
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.mode]);

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
          <WorkOrderForm 
            initialData={workOrder} 
            isEdit={true} 
            onUpdateSuccess={() => refetch()} 
          />
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
  
  // Import the getUserRole function directly since we can't use hooks in SSR
  const { getUserRoleFromSession } = require('../../../utils/auth0-helpers');
  
  // Server-side role check using the helper function
  const userRole = getUserRoleFromSession(session.user);
  const isAdmin = userRole === 'admin' || userRole === 'manager';
  
  console.log('Server-side role check:', userRole, isAdmin);
  
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