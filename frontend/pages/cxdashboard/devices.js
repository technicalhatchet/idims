import { FaLaptop } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import PortalComingSoon from '../../components/cxdashboard/PortalComingSoon';

export default function DevicesPage() {
  return (
    <PortalComingSoon
      title="My Devices"
      description="A list of your registered appliances and TVs will appear here soon, including service history and warranty status for each device."
      icon={FaLaptop}
    />
  );
}

DevicesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="My Devices">{page}</DashboardLayout>;
};
