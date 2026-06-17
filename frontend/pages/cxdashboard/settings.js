import { FaCog } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import PortalComingSoon from '../../components/cxdashboard/PortalComingSoon';

export default function SettingsPage() {
  return (
    <PortalComingSoon
      title="Account Settings"
      description="Update your contact information and notification preferences here soon. Contact us if you need to change your email or phone number in the meantime."
      icon={FaCog}
    />
  );
}

SettingsPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Account Settings">{page}</DashboardLayout>;
};
