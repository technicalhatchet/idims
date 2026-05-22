import { getSession } from '@auth0/nextjs-auth0';
import { useEffect } from 'react';
import WorkOrderForm from '../../components/work_orders/WorkOrderForm';
import WorkOrderMobileShell from '../../components/work_orders/WorkOrderMobileShell';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import { useTheme } from '../../context/ThemeContext';

function NewWorkOrderMobile() {
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });
  const { theme } = useTheme();

  useEffect(() => {
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.mode]);

  return (
    <WorkOrderMobileShell
      title="Create Work Order"
      pageTitle="New Work Order | Atomic Repair"
      backHref="/work_orders/test"
      scanKey="wo-new-mobile"
    >
      <WorkOrderForm variant="mobile" cancelHref="/work_orders/test" />
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
