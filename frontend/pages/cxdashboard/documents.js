import { FaFileSignature } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import PortalComingSoon from '../../components/cxdashboard/PortalComingSoon';

export default function DocumentsPage() {
  return (
    <PortalComingSoon
      title="Documents"
      description="This is where service agreements, authorizations, and other paperwork to sign will live. Estimates and invoices stay on Invoices & Payments."
      icon={FaFileSignature}
    />
  );
}

DocumentsPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Documents">{page}</DashboardLayout>;
};
