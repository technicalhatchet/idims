import { useRouter } from 'next/router';
import { getSession } from '@auth0/nextjs-auth0';
import TechDashboardLayout from '../../../../components/layouts/TechDashboardLayout';
import TechboardHudDoubleTapShell from '../../../../components/layouts/TechboardHudDoubleTapShell';
import DebriefingFullPage from '../../../../components/work_orders/DebriefingFullPage';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';

function WorkOrderDebriefingPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!router.isReady || !id) {
    return (
      <TechboardHudDoubleTapShell contentClassName="py-10 flex justify-center pb-24">
        <LoadingSpinner size="large" />
      </TechboardHudDoubleTapShell>
    );
  }

  return (
    <TechboardHudDoubleTapShell contentClassName="relative z-10 pb-24" columnClassName="">
      <DebriefingFullPage workOrderId={id} />
    </TechboardHudDoubleTapShell>
  );
}

WorkOrderDebriefingPage.getLayout = function getLayout(page) {
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

export default WorkOrderDebriefingPage;
