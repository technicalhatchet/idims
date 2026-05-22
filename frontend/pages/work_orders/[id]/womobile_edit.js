import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import WorkOrderForm from '../../../components/work_orders/WorkOrderForm';
import WorkOrderMobileShell from '../../../components/work_orders/WorkOrderMobileShell';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useWorkOrder } from '../../../hooks/useWorkOrders';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';
import { useTheme } from '../../../context/ThemeContext';

function EditWorkOrderMobile({ id }) {
  const router = useRouter();
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const { theme } = useTheme();

  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  useEffect(() => {
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.mode]);

  if (isLoading) {
    return (
      <WorkOrderMobileShell
        title="Edit Work Order"
        pageTitle="Edit Work Order | Atomic Repair"
        backHref={`/work_orders/${id}/mobile`}
        scanKey="wo-edit-mobile"
      >
        <div className="py-10 flex justify-center">
          <LoadingSpinner size="large" />
        </div>
      </WorkOrderMobileShell>
    );
  }

  if (error) {
    return (
      <WorkOrderMobileShell
        title="Edit Work Order"
        pageTitle="Edit Work Order | Atomic Repair"
        backHref={`/work_orders/${id}/mobile`}
        scanKey="wo-edit-mobile"
      >
        <ErrorAlert message="Failed to load work order" onRetry={() => router.reload()} />
      </WorkOrderMobileShell>
    );
  }

  return (
    <WorkOrderMobileShell
      title="Edit Work Order"
      pageTitle={`Edit ${workOrder?.order_number || 'Work Order'} | Atomic Repair`}
      backHref={`/work_orders/${id}/mobile`}
      subtitle={workOrder?.order_number ? `#${workOrder.order_number}` : undefined}
      scanKey="wo-edit-mobile"
      syncKey={workOrder?.id}
    >
      <WorkOrderForm
        variant="mobile"
        initialData={workOrder}
        isEdit
        cancelHref={`/work_orders/${id}/mobile`}
        onUpdateSuccess={() => refetch()}
      />
    </WorkOrderMobileShell>
  );
}

EditWorkOrderMobile.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export async function getServerSideProps(context) {
  const { id } = context.params;

  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }

  const { getUserRoleFromSession } = require('../../../utils/auth0-helpers');
  const userRole = getUserRoleFromSession(session.user);
  const isAdmin = userRole === 'admin' || userRole === 'manager';

  if (!isAdmin) {
    return {
      redirect: {
        destination: '/unauthorized',
        permanent: false,
      },
    };
  }

  return {
    props: { id },
  };
}

export default EditWorkOrderMobile;
