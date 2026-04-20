// src/pages/quotes/index.js
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FaPlus, FaFilter, FaSearch } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import QuotesTable from '../../components/quotes/QuotesTable';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Pagination from '../../components/ui/Pagination';
import { useQuotes } from '../../hooks/useQuotes';
import { withPageAuthRequired } from '../../utils/auth0-helpers';

function Quotes() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const limit = 10;
  
  const { 
    quotes, 
    isLoading, 
    isError, 
    error, 
    totalPages, 
    refetch 
  } = useQuotes({ page, limit, searchTerm, ...filters });

  const handleSearch = (e) => {
    e.preventDefault();
    const searchInput = e.target.elements.search.value;
    setSearchTerm(searchInput);
    setPage(1); // Reset to first page when searching
  };
  
  const handleFilterToggle = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  return (
    <>
      <Head>
        <title>Quotes | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">Quotes</h1>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <form onSubmit={handleSearch} className="flex">
              <input
                type="text"
                name="search"
                placeholder="Search quotes..."
                className="border rounded-l px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={searchTerm}
              />
              <button
                type="submit"
                className="bg-gray-200 text-gray-700 rounded-r px-4 py-2 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <FaSearch />
              </button>
            </form>
            <button
              onClick={handleFilterToggle}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded flex items-center justify-center hover:bg-gray-300"
              aria-label="Filter quotes"
            >
              <FaFilter className="mr-2" />
              Filters
            </button>
            <Link
              href="/quotes/new"
              className="bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center hover:bg-blue-700 transition duration-150"
            >
              <FaPlus className="mr-2" /> New Quote
            </Link>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <ErrorAlert message={error?.message || 'Failed to load quotes'} />
        ) : (
          <>
            <QuotesTable quotes={quotes} />
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}

        {/* QuoteFilterDrawer component would go here */}
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsFilterOpen(false)}></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Filter Quotes</h3>
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

Quotes.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(Quotes);