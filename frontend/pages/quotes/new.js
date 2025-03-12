// src/pages/quotes/new.js
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import QuoteForm from '../../components/quotes/QuoteForm';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

function NewQuote() {
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  return (
    <>
      <Head>
        <title>New Quote | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create New Quote</h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <QuoteForm />
        </div>
      </div>
    </>
  );
}

NewQuote.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default NewQuote;

