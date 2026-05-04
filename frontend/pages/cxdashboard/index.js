import Head from 'next/head';
import { FaCalendarAlt, FaTools, FaFileInvoiceDollar, FaShieldAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import StatCard from '../../components/cxdashboard/StatCard';
import AppointmentCard from '../../components/cxdashboard/AppointmentCard';
import RepairStatus from '../../components/cxdashboard/RepairStatus';
import RecentRepairs from '../../components/cxdashboard/RecentRepairs';
import InvoiceList from '../../components/cxdashboard/InvoiceList';
import SupportCTA from '../../components/cxdashboard/SupportCTA';

const STATS = [
  {
    title: 'Upcoming Appointments',
    value: '1',
    subtitle: 'Next: May 24, 2025',
    icon: FaCalendarAlt,
    href: '/cxdashboard/appointments'
  },
  {
    title: 'Active Repairs',
    value: '1',
    subtitle: 'In Progress',
    icon: FaTools,
    href: '/cxdashboard/repairs',
    highlight: true
  },
  {
    title: 'Total Invoices',
    value: '3',
    subtitle: '2 Paid • 1 Outstanding',
    icon: FaFileInvoiceDollar,
    href: '/cxdashboard/invoices'
  },
  {
    title: 'Warranty Coverage',
    value: '2',
    subtitle: 'Active',
    icon: FaShieldAlt,
    href: '/cxdashboard/warranty'
  }
];

const UPCOMING_APPOINTMENT = {
  id: '1',
  status: 'Confirmed',
  date: 'Sat, May 24, 2025',
  time: '10:00 AM – 12:00 PM',
  service: 'Refrigerator Repair',
  address: '123 Main St.',
  city: 'Toledo, OH 43604',
  image: '/applianceicons/neon/neonfridge.png'
};

const ACTIVE_REPAIR = {
  id: 'QR-7824',
  status: 'In Progress',
  service: 'Washer Repair',
  date: 'May 18, 2025',
  orderNumber: 'QR-7824',
  technician: 'Mike Thompson',
  phone: '(419) 555-1234',
  icon: '/applianceicons/neon/neonwasher.png',
  currentStep: 1
};

export default function ClientDashboard() {
  return (
    <>
      <Head>
        <title>Client Portal | Atomic Repair</title>
        <link rel="manifest" href="/manifest-client.json" />
      </Head>
      <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {STATS.map((stat, index) => (
          <StatCard key={stat.title} {...stat} index={index} />
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <AppointmentCard appointment={UPCOMING_APPOINTMENT} />
          <RecentRepairs />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <RepairStatus repair={ACTIVE_REPAIR} />
          <InvoiceList />
        </div>
      </div>

      {/* Support CTA */}
      <SupportCTA />
    </div>
    </>
  );
}

ClientDashboard.getLayout = function getLayout(page) {
  return <DashboardLayout title="Dashboard">{page}</DashboardLayout>;
};
