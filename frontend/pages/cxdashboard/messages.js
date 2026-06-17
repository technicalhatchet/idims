import { FaEnvelope } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import PortalComingSoon from '../../components/cxdashboard/PortalComingSoon';

export default function MessagesPage() {
  return (
    <PortalComingSoon
      title="Messages"
      description="Secure messaging with Atomic Repair is coming soon. For now, call or email us and we'll get back to you quickly."
      icon={FaEnvelope}
    />
  );
}

MessagesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Messages">{page}</DashboardLayout>;
};
