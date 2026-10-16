/**
 * Dev-only shell preview for portal chrome (no API / auth). Not linked in prod nav.
 */
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';

export default function BrandLayoutPreview() {
  return (
    <DashboardLayout title="Dashboard" user={{ name: 'Jane Client', firstName: 'Jane' }}>
      <p className="text-gray-500 text-sm">Portal layout preview.</p>
    </DashboardLayout>
  );
}
