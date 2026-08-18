import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FaFileInvoiceDollar } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import Pagination from '../../components/ui/Pagination';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useInvoices } from '../../services/api/invoicesApi';

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function invoiceHref(invoice) {
  if (invoice.work_order_id) return `/work_orders/${invoice.work_order_id}`;
  return `/invoices/${invoice.id}`;
}

function Invoices() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const limit = 20;
  const { data, isLoading, error, refetch } = useInvoices({
    page,
    limit,
    status: status || undefined,
  });

  const items = data?.items || [];
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / limit));

  return (
    <>
      <Head>
        <title>Invoices | IDIMS</title>
      </Head>
      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Invoices</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Standalone invoices. Work-order billing still lives on the job.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="border rounded px-3 py-2 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="canceled">Canceled</option>
            </select>
            <Link href="/payments" className="text-sm text-cyan-600 hover:text-cyan-500">
              Payments →
            </Link>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert message="Failed to load invoices" onRetry={refetch} />
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FaFileInvoiceDollar className="text-4xl mx-auto mb-3 opacity-40" />
            <p>No invoices found.</p>
            <p className="text-sm mt-2">
              Most billing is on the work order.{' '}
              <Link href="/work_orders" className="text-cyan-600 hover:text-cyan-500">Open work orders</Link>
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Work order</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Issued</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {items.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="px-4 py-3">
                        <Link href={invoiceHref(inv)} className="font-medium text-cyan-600 hover:text-cyan-500">
                          {inv.invoice_number || String(inv.id).slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{inv.client_name || '—'}</td>
                      <td className="px-4 py-3">
                        {inv.work_order_id ? (
                          <Link href={`/work_orders/${inv.work_order_id}`} className="text-cyan-600 hover:text-cyan-500">
                            {inv.work_order_number || 'Open WO'}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">{(inv.status || '—').replace('_', ' ')}</td>
                      <td className="px-4 py-3">{formatDate(inv.issue_date)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(inv.total ?? inv.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(inv.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

Invoices.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default Invoices;
