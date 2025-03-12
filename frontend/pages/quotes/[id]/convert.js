// src/pages/quotes/[id]/convert.js
import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import QuoteConvertForm from '../../components/quotes/QuoteConvertForm';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useQuote, useQuoteMutations } from '../../hooks/useQuotes';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

function ConvertQuote() {
  const router = useRouter();
  const { id } = router.query;
  const [conversionResult, setConversionResult] = useState(null);

  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  // Fetch quote details
  const {
    data: quote,
    isLoading,
    error,
    refetch
  } = useQuote(id);

  // Quote mutations
  const {
    convertQuote,
    isLoading: isConverting
  } = useQuoteMutations();

  const handleConvert = async (convertData) => {
    try {
      const result = await convertQuote({
        id,
        data: convertData
      });

      setConversionResult(result);

      // Redirect after a brief delay to show success message
      setTimeout(() => {
        if (convertData.convert_to === 'work_order' && result.work_order_id) {
          router.push(`/work-orders/${result.work_order_id}`);
        } else if (convertData.convert_to === 'invoice' && result.invoice_id) {
          router.push(`/invoices/${result.invoice_id}`);
        } else {
          router.push(`/quotes/${id}`);
        }
      }, 2000);
    } catch (error) {
      console.error('Error converting quote:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <ErrorAlert
          message="Failed to load quote details"
          onRetry={refetch}
        />
      </div>
    );
  }

  if (conversionResult) {
    const conversionType = conversionResult.work_order_id ? 'work order' : 'invoice';
    const conversionId = conversionResult.work_order_id || conversionResult.invoice_id;
    const conversionPath = conversionResult.work_order_id ? '/work-orders/' : '/invoices/';

    return (
      <div className="px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Quote successfully converted to {conversionType}!
                </p>
                <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <Link
                      href={`${conversionPath}${conversionId}`}
                      className="px-2 py-1.5 rounded-md text-sm font-medium text-green-800 hover:bg-green-100"
                    >
                      View {conversionType}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-500">
            Redirecting you to the new {conversionType}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`Convert Quote ${quote.quote_number} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <Link href={`/quotes/${id}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Quote
          </Link>
          <h1 className="text-2xl font-bold mt-4">Convert Quote to Work Order or Invoice</h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <QuoteConvertForm
            quote={quote}
            onCancel={() => router.push(`/quotes/${id}`)}
            onSubmit={handleConvert}
            isSubmitting={isConverting}
          />
        </div>
      </div>
    </>
  );
}

ConvertQuote.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default ConvertQuote;