// src/pages/quotes/new.js
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import QuoteForm from '../../components/quotes/QuoteForm';
import { withPageAuthRequired } from '../../utils/auth0-helpers';

function NewQuote() {
  const router = useRouter();
  const { clientId } = router.query;
  
  return (
    <>
      <Head>
        <title>Create New Quote | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/quotes" className="text-blue-600 hover:text-blue-800">
              ← Back to Quotes
            </Link>
            <h1 className="text-2xl font-bold mt-2">Create New Quote</h1>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <QuoteForm clientId={clientId} />
        </div>
      </div>
    </>
  );
}

NewQuote.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(NewQuote);

