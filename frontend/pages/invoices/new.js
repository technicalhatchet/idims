import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import DashboardLayout from '../../components/layouts/DashboardLayout';

function NewInvoice() {
  const router = useRouter();
  const clientId = typeof router.query.client_id === 'string' ? router.query.client_id : '';

  return (
    <>
      <Head>
        <title>Create Invoice | IDIMS</title>
      </Head>
      <div className="px-4 py-6 max-w-xl">
        <h1 className="text-2xl font-bold mb-2">Create Invoice</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Invoices are generated from a work order so parts, labor, and the diagnostic fee stay together.
        </p>
        <div className="space-y-3">
          {clientId ? (
            <>
              <Link
                href={`/work_orders/new?client_id=${clientId}`}
                className="block w-full text-center px-4 py-3 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-500"
              >
                Create a work order for this client
              </Link>
              <Link
                href={`/clients/${clientId}`}
                className="block w-full text-center px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Back to client
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/work_orders/new"
                className="block w-full text-center px-4 py-3 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-500"
              >
                Create a work order
              </Link>
              <Link
                href="/invoices"
                className="block w-full text-center px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                View invoices
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}

NewInvoice.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default NewInvoice;
