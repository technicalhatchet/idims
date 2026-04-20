import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlus, FaFilter, FaUser, FaBuilding, FaEnvelope, FaPhone } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Pagination from '../../components/ui/Pagination';
import { useClients } from '../../services/api/clientsApi';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

function ClientsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  
  // Authorization check
  useAuthRedirect();
  
  // Fetch clients with pagination and filters
  const { 
    data, 
    isLoading, 
    error,
    refetch
  } = useClients({ page, limit, search, status });
  
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };
  
  const handleStatusChange = (e) => {
    setStatus(e.target.value);
  };
  
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset to first page when searching
    refetch();
  };
  
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPage(1);
  };
  
  return (
    <>
      <Head>
        <title>Clients | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-2xl font-bold mb-4 sm:mb-0 text-gray-900 dark:text-white">Clients</h1>
          <div className="flex space-x-2">
            <Link 
              href="/clients/new" 
              className="btn-primary flex items-center dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              <FaPlus className="mr-2" />
              New Client
            </Link>
          </div>
        </div>
        
        {/* Search and filters */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="search" className="sr-only">Search clients</label>
              <input
                type="text"
                id="search"
                placeholder="Search by name, email, or company..."
                className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <div className="w-full md:w-48">
              <label htmlFor="status" className="sr-only">Filter by status</label>
              <select
                id="status"
                className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={status}
                onChange={handleStatusChange}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="lead">Lead</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                Search
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
        
        {/* Client list */}
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert 
            message="Failed to load clients" 
            onRetry={refetch}
            error={error}
          />
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Client</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contact</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data?.items?.length > 0 ? (
                      data.items.map((client) => (
                        <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-full">
                                {client.company_name ? (
                                  <FaBuilding className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <FaUser className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {client.company_name || `${client.first_name} ${client.last_name}`}
                                </div>
                                {client.company_name && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {`${client.first_name} ${client.last_name}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white flex items-center">
                              <FaEnvelope className="mr-2 text-gray-400 dark:text-gray-500" />
                              {client.email || 'No email provided'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                              <FaPhone className="mr-2 text-gray-400 dark:text-gray-500" />
                              {client.phone || 'No phone provided'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${client.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                                client.status === 'inactive' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                              {client.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            <Link
                              href={`/clients/${client.id}`}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                            >
                              View
                            </Link>
                            <Link
                              href={`/clients/${client.id}/edit`}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              Edit
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          No clients found. Try adjusting your search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Pagination */}
            {data?.total > 0 && (
              <div className="mt-6">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil((data?.total || 0) / limit)}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Use the dashboard layout
ClientsPage.getLayout = function getLayout(page) {
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

export default ClientsPage; 