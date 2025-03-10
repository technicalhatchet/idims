import { FaClipboardList, FaCalendarAlt, FaFileInvoiceDollar, FaChartLine } from 'react-icons/fa';
import DashboardCard from './DashboardCard';

export default function StatsOverview({ stats }) {
  // If no stats provided, show default cards with loading state
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard 
          title="Work Orders"
          value="--"
          icon={<FaClipboardList className="h-6 w-6" />}
          color="blue"
          isLoading={true}
        />
        <DashboardCard 
          title="Today's Jobs"
          value="--"
          icon={<FaCalendarAlt className="h-6 w-6" />}
          color="green"
          isLoading={true}
        />
        <DashboardCard 
          title="Pending Invoices"
          value="--"
          icon={<FaFileInvoiceDollar className="h-6 w-6" />}
          color="indigo"
          isLoading={true}
        />
        <DashboardCard 
          title="Revenue (Month)"
          value="--"
          icon={<FaChartLine className="h-6 w-6" />}
          color="purple"
          isLoading={true}
        />
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardCard 
        title="Work Orders"
        value={stats.workOrdersCount}
        subtitle={stats.workOrdersPending ? `${stats.workOrdersPending} pending` : null}
        icon={<FaClipboardList className="h-6 w-6" />}
        color="blue"
        trend={stats.workOrdersTrend}
        link={stats.workOrdersLink}
      />
      <DashboardCard 
        title="Today's Jobs"
        value={stats.todaysJobsCount}
        subtitle={stats.todaysJobsCompleted ? `${stats.todaysJobsCompleted} completed` : null}
        icon={<FaCalendarAlt className="h-6 w-6" />}
        color="green"
        link={stats.todaysJobsLink}
      />
      <DashboardCard 
        title="Pending Invoices"
        value={stats.pendingInvoicesCount}
        subtitle={stats.pendingInvoicesValue ? `$${stats.pendingInvoicesValue}` : null}
        icon={<FaFileInvoiceDollar className="h-6 w-6" />}
        color="indigo"
        link={stats.pendingInvoicesLink}
      />
      <DashboardCard 
        title="Revenue (Month)"
        value={`$${stats.monthlyRevenue}`}
        subtitle={stats.revenueComparison ? `${stats.revenueComparison}% vs last month` : null}
        icon={<FaChartLine className="h-6 w-6" />}
        color="purple"
        trend={stats.revenueTrend}
        link={stats.revenueLink}
      />
    </div>
  );
}