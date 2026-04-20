import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlus, FaSearch, FaFilter } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import TechniciansTable from '../../components/technicians/TechniciansTable';
import Pagination from '../../components/ui/Pagination';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useTechnicians } from '../../hooks/useTechnicians';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

function Technicians() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const limit = 10;
  
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  // Fetch technicians with pagination and filters
  const { 
    data, 
    isLoading,
    error,
    refetch
  } = useTechnicians({ page, limit, ...filters });

  // Debug logs
  console.log('Technicians page - attempting to fetch data');
  console.log('Filters:', filters);
  
  useEffect(() => {
    if (data) {
      console.log('Technicians data loaded successfully:', data);
    }
    if (error) {
      console.error('Technicians fetch error:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
  }, [data, error]);

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
        <title>Technicians | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-2xl font-bold mb-4 sm:mb-0">Technicians</h1>
          <div className="flex space-x-2">
            <button
              onClick={handleFilterToggle}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <FaFilter className="mr-2" />
              Filters
            </button>
            <Link
              href="/technicians/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <FaPlus className="mr-2" />
              Add Technician
            </Link>
          </div>
        </div>

        {isFilterOpen && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            {/* Filter form will go here */}
          </div>
        )}

        {error && (
          <ErrorAlert
            message={error.message}
            onRetry={refetch}
          />
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <TechniciansTable
              technicians={data?.items || []}
              isLoading={isLoading}
            />
            
            {data && (
              <Pagination
                currentPage={page}
                totalPages={data.pages}
                onPageChange={setPage}
                totalItems={data.total}
                itemsPerPage={limit}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

// Add server-side props with auth
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

// Export the component with layout
export default function TechniciansWithLayout(props) {
  return (
    <DashboardLayout>
      <Technicians {...props} />
    </DashboardLayout>
  );
}