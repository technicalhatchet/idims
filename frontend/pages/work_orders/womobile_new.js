import { getSession } from '@auth0/nextjs-auth0';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import WorkOrderForm from '../../components/work_orders/WorkOrderForm';
import WorkOrderMobileShell from '../../components/work_orders/WorkOrderMobileShell';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import { useTheme } from '../../context/ThemeContext';

function NewWorkOrderMobile() {
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.mode]);

  // Build initialData from query params
  const initialData = useMemo(() => {
    const { client_id, address, property_id } = router.query;
    if (!client_id && !address && !property_id) return undefined;
    
    return {
      client_id: client_id || '',
      service_location: address ? { address } : undefined,
      property_id: property_id || undefined,
    };
  }, [router.query]);

  return (
    <WorkOrderMobileShell
      title="Create Work Order"
      pageTitle="New Work Order | Atomic Repair"
      backHref="/work_orders/test"
      scanKey="wo-new-mobile"
    >
      <WorkOrderForm variant="mobile" cancelHref="/work_orders/test" initialData={initialData} />
    </WorkOrderMobileShell>
  );
}

NewWorkOrderMobile.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export async function getServerSideProps(context) {
  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }

  return { props: {} };
}

export default NewWorkOrderMobile;
