// src/pages/quotes/[id]/index.js
import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaEdit, FaExchangeAlt, FaEnvelope } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import QuoteDetails from '@/components/quotes/QuoteDetails';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useQuote } from '@/hooks/useQuotes';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

function QuoteDetail() {
  const router = useRouter();
  const { id } = router.query;

  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  // Fetch quote details
  const {
    data: quote,
    isLoading,
    error,
    refetch
  } = useQuote(id);

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

  return (
    <>
      <Head>
        <title>{`Quote ${quote.quote_number} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
          <div>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold mr-3">
                Quote: {quote.quote_number}
              </h1>
            </div>
            <p className="text-gray-500 mt-1">Total: ${quote.total.toFixed(2)}</p>
          </div>

          <div className="mt-4 md:mt-0 flex space-x-2">
            <Link
              href={`/quotes/${id}/edit`}
              className="btn-outline flex items-center"
            >
              <FaEdit className="mr-2" />
              Edit
            </Link>
            <Link
              href={`/quotes/${id}/convert`}
              className="btn-primary flex items-center"
            >
              <FaExchangeAlt className="mr-2" />
              Convert
            </Link>
            <button
              className="btn-outline flex items-center"
            >
              <FaEnvelope className="mr-2" />
              Send to Client
            </button>
          </div>
        </div>

        {/* Quote Details */}
        <QuoteDetails quote={quote} />
      </div>
    </>
  );
}

QuoteDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default QuoteDetail;