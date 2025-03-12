import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlus, FaFilter } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import WorkOrderTable from '@/components/work-orders/WorkOrderTable';
import Pagination from '@/components/ui/Pagination';
import FilterDrawer from '@/components/work-orders/FilterDrawer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import { useWorkOrders } from '@/hooks/useWorkOrders';

function WorkOrders() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const limit = 10;

  // Fetch work orders with pagination and filters
  const { 
    data, 
    isLoading,
    error,
    refetch
  } = useWorkOrders({ page, limit, ...filters });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleFilterToggle = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  return (
    <>
      <Head>
        <title>Work Orders | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-2xl font-bold mb-4 sm:mb-0">Work Orders</h1>
          <div className="flex space-x-2">
            <button
              onClick={handleFilterToggle}
              className="btn-outline flex items-center"
              aria-label="Filter work orders"
            >
              <FaFilter className="mr-2" />
              Filters
            </button>
            <Link href="/work-orders/new" className="btn-primary flex items-center">
              <FaPlus className="mr-2" />
              New Work Order
            </Link>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert 
            message="Failed to load work orders" 
            onRetry={refetch}
          />
        ) : (
          <>
            <WorkOrderTable workOrders={data?.items || []} />
            
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil((data?.total || 0) / limit)}
                onPageChange={setPage}
              />
            </div>
          </>
        )}

        <FilterDrawer
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      </div>
    </>
  );
}

// Use the dashboard layout
WorkOrders.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

// Make this page require authentication
export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default WorkOrders;