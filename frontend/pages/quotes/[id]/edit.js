// src/pages/quotes/[id]/edit.js
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import QuoteForm from '../..//components/quotes/QuoteForm';
import LoadingSpinner from '../..//components/ui/LoadingSpinner';
import ErrorAlert from '../..//components/ui/ErrorAlert';
import { useQuote } from '../..//hooks/useQuotes';
import { useAuthRedirect } from '../..//hooks/useAuthRedirect';

function EditQuote() {
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
        <title>{`Edit Quote ${quote.quote_number} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Edit Quote</h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <QuoteForm
            initialData={quote}
            isEdit={true}
          />
        </div>
      </div>
    </>
  );
}

EditQuote.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default EditQuote;