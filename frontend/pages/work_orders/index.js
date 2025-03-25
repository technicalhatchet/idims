import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlus, FaFilter } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import WorkOrderTable from '../../components/work_orders/WorkOrderTable';
import Pagination from '../../components/ui/Pagination';
import FilterDrawer from '../../components/work_orders/FilterDrawer';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useWorkOrders } from '../../hooks/useWorkOrders';

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
          <h1 className="text-2xl font-bold mb-4 sm:mb-0 text-gray-900 dark:text-white">Work Orders</h1>
          <div className="flex space-x-2">
            <button
              onClick={handleFilterToggle}
              className="btn-outline flex items-center dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
              aria-label="Filter work orders"
            >
              <FaFilter className="mr-2" />
              Filters
            </button>
            <Link href="/work_orders/new" className="btn-primary flex items-center dark:bg-blue-700 dark:hover:bg-blue-800">
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

// Server-side authentication check
export async function getServerSideProps(context) {
  // Check authentication
  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }
  
  // Return empty props as data fetching happens on the client
  return {
    props: {},
  };
}

export default WorkOrders;