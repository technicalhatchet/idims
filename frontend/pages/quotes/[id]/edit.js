// src/pages/quotes/[id]/edit.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import QuoteForm from '../../../components/quotes/QuoteForm';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useQuote } from '../../../hooks/useQuotes';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';

function EditQuote() {
  const router = useRouter();
  const { id } = router.query;
  
  const { quote, isLoading, isError, error } = useQuote(id);

  if (isLoading || !id) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return <ErrorAlert message={error?.message || 'Failed to load quote'} />;
  }

  return (
    <>
      <Head>
        <title>{`Edit Quote #${quote?.quoteNumber || id} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <Link href={`/quotes/${id}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Quote Details
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            Edit Quote #{quote?.quoteNumber || id}
          </h1>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <QuoteForm quote={quote} isEdit={true} />
        </div>
      </div>
    </>
  );
}

EditQuote.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(EditQuote);