import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlus, FaFilter } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import TechniciansTable from '@/components/technicians/TechniciansTable';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

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
              className="btn-outline flex items-center"
              aria-label="Filter technicians"
            >
              <FaFilter className="mr-2" />
              Filters
            </button>
            <Link href="/technicians/new" className="btn-primary flex items-center">
              <FaPlus className="mr-2" />
              New Technician
            </Link>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert 
            message="Failed to load technicians" 
            onRetry={refetch}
          />
        ) : (
          <>
            <TechniciansTable technicians={data?.items || []} />
            
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil((data?.total || 0) / limit)}
                onPageChange={setPage}
              />
            </div>
          </>
        )}

        {/* TechnicianFilterDrawer component would go here */}
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsFilterOpen(false)}></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Filter Technicians</h3>
                  {/* Filter form would go here */}
                  <p className="text-gray-500">Filter form components would go here.</p>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

Technicians.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default Technicians;