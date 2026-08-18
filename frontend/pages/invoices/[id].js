import { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useInvoice } from '../../services/api/invoicesApi';

function InvoiceDetail() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { data: invoice, isLoading, error, refetch } = useInvoice(id);

  useEffect(() => {
    if (invoice?.work_order_id) {
      router.replace(`/work_orders/${invoice.work_order_id}`);
    }
  }, [invoice, router]);

  return (
    <>
      <Head>
        <title>Invoice | IDIMS</title>
      </Head>
      <div className="px-4 py-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert message="Failed to load invoice" onRetry={refetch} />
        ) : !invoice ? (
          <p className="text-gray-500">Invoice not found.</p>
        ) : invoice.work_order_id ? (
          <p className="text-gray-500">Opening work order…</p>
        ) : (
          <div className="max-w-lg space-y-3">
            <h1 className="text-2xl font-bold">
              {invoice.invoice_number || 'Invoice'}
            </h1>
            <p className="text-sm text-gray-500 capitalize">Status: {(invoice.status || '—').replace('_', ' ')}</p>
            <p className="text-sm">Total: ${Number(invoice.total ?? invoice.total_amount ?? 0).toFixed(2)}</p>
            <p className="text-sm">Balance: ${Number(invoice.balance ?? 0).toFixed(2)}</p>
            {invoice.client_id && (
              <Link href={`/clients/${invoice.client_id}`} className="inline-block text-cyan-600 hover:text-cyan-500">
                View client →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

InvoiceDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default InvoiceDetail;
