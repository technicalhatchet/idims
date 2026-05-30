import { useState } from 'react';
import Head from 'next/head';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { getMonthlyEconomicsReport } from '../../services/api/jobEconomicsApi';
import { formatMoney } from '../../components/work_orders/WorkOrderExpensesPanel';
import { useUserRole } from '../../utils/auth0-helpers';
import { withPageAuthRequired } from '../../utils/auth0-helpers';

function JobEconomicsReportPage() {
  const { isManager } = useUserRole();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runReport = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await getMonthlyEconomicsReport(year, month);
      setData(result);
    } catch (err) {
      setError(err.message || 'Report failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isManager) {
    return (
      <div className="p-6 text-gray-600 dark:text-gray-400">Manager or admin access required.</div>
    );
  }

  return (
    <>
      <Head>
        <title>Job Economics Report</title>
      </Head>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Monthly job economics</h1>
        <p className="text-sm text-gray-500 mb-6">Operational estimate — not tax advice.</p>

        <form onSubmit={runReport} className="flex flex-wrap gap-3 mb-6">
          <input type="number" className="rounded border px-3 py-2 w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <input type="number" min={1} max={12} className="rounded border px-3 py-2 w-20" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium" disabled={loading}>
            {loading ? 'Loading…' : 'Run report'}
          </button>
        </form>

        {error && <ErrorAlert message={error} onRetry={runReport} />}
        {loading && <LoadingSpinner />}

        {data && !loading && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
              <h2 className="font-semibold mb-3">{format(new Date(year, month - 1), 'MMMM yyyy')}</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt>Revenue collected</dt><dd>{formatMoney(data.revenue_collected)}</dd></div>
                <div className="flex justify-between"><dt>Parts cost</dt><dd>{formatMoney(data.parts_cost)}</dd></div>
                <div className="flex justify-between"><dt>Other expenses</dt><dd>{formatMoney(data.other_expenses)}</dd></div>
                <div className="flex justify-between"><dt>Mileage ({data.mileage_miles} mi)</dt><dd>{formatMoney(data.mileage_cost)}</dd></div>
                <div className="flex justify-between font-semibold border-t pt-2"><dt>Est. net</dt><dd>{formatMoney(data.estimated_net)}</dd></div>
              </dl>
            </div>

            {data.expenses_by_category?.length > 0 && (
              <div className="rounded-xl border p-4 bg-white dark:bg-gray-800">
                <h3 className="font-semibold mb-2">By category</h3>
                <ul className="text-sm space-y-1">
                  {data.expenses_by_category.map((row) => (
                    <li key={row.label} className="flex justify-between"><span>{row.label}</span><span>{formatMoney(row.amount)}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {data.top_vendors?.length > 0 && (
              <div className="rounded-xl border p-4 bg-white dark:bg-gray-800">
                <h3 className="font-semibold mb-2">Top vendors</h3>
                <ul className="text-sm space-y-1">
                  {data.top_vendors.map((row) => (
                    <li key={row.label} className="flex justify-between"><span>{row.label}</span><span>{formatMoney(row.amount)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

JobEconomicsReportPage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(JobEconomicsReportPage);
