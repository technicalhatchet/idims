import { FaFolder } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import PortalComingSoon from '../../components/cxdashboard/PortalComingSoon';

export default function DocumentsPage() {
  return (
    <PortalComingSoon
      title="Documents"
      description="Estimates, invoices, and service documents will be stored here for easy download."
      icon={FaFolder}
    />
  );
}

DocumentsPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Documents">{page}</DashboardLayout>;
};
