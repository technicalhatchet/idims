// src/pages/quotes/[id]/convert.js
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useQuote } from '../../../hooks/useQuotes';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';

function ConvertQuote() {
  const router = useRouter();
  const { id } = router.query;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const { quote, isLoading, isError, fetchError } = useQuote(id);

  const handleConvert = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // This would be replaced with an actual API call to convert the quote
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to the work orders page
      router.push('/work_orders');
    } catch (err) {
      console.error('Error converting quote:', err);
      setError('Failed to convert quote. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !id) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return <ErrorAlert message={fetchError?.message || 'Failed to load quote'} />;
  }

  // Check if quote is already converted
  if (quote?.isConverted) {
    return (
      <div className="px-4 py-6">
        <div className="mb-6">
          <Link href={`/quotes/${id}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Quote Details
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            Quote Already Converted
          </h1>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <p className="mb-4">This quote has already been converted to a work order.</p>
          <Link 
            href={`/work_orders/${quote.workOrderId}`}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Work Order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`Convert Quote #${quote?.quoteNumber || id} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <Link href={`/quotes/${id}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Quote Details
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            Convert Quote #{quote?.quoteNumber || id} to Work Order
          </h1>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Conversion Details</h2>
          
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Client</h3>
                <p>{quote?.client?.name || 'Unknown Client'}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Quote Number</h3>
                <p>#{quote?.quoteNumber || id}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Date</h3>
                <p>{quote?.date || 'N/A'}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Amount</h3>
                <p>${quote?.total?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-6 mb-6">
            <h3 className="font-medium mb-2">Work Order Details</h3>
            <p className="text-sm text-gray-500 mb-4">
              Converting this quote will create a new work order with all the items from the quote.
            </p>
            
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
                {error}
              </div>
            )}
            
            <div className="flex justify-end space-x-4">
              <Link
                href={`/quotes/${id}`}
                className="px-4 py-2 border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </Link>
              
              <button
                onClick={handleConvert}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? 'Converting...' : 'Convert to Work Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

ConvertQuote.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(ConvertQuote);