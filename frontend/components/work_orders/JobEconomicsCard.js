import { useEffect, useState } from 'react';
import { getJobEconomics } from '../../services/api/jobEconomicsApi';
import { formatMoney } from './WorkOrderExpensesPanel';

export default function JobEconomicsCard({ workOrderId, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!workOrderId) return;
    setLoading(true);
    getJobEconomics(workOrderId)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load job economics'))
      .finally(() => setLoading(false));
  }, [workOrderId]);

  if (loading) {
    return <p className="text-xs text-gray-500">Loading job economics…</p>;
  }
  if (error) {
    return <p className="text-xs text-amber-400">{error}</p>;
  }
  if (!data) return null;

  return (
    <div className={`rounded-xl p-4 ${isMobile ? 'border border-amber-500/25 bg-amber-950/20' : 'border border-amber-200 bg-amber-50 dark:bg-amber-950/30'}`}>
      <h3 className={`text-sm font-semibold mb-3 ${isMobile ? 'text-amber-200' : 'text-amber-900 dark:text-amber-200'}`}>
        Job economics (estimate)
      </h3>
      <dl className="space-y-2">
        {data.line_items?.map((row) => (
          <div key={row.label} className="flex justify-between text-sm">
            <dt className={row.label === 'Est. net' ? 'font-semibold text-white' : 'text-gray-400'}>{row.label}</dt>
            <dd className={row.label === 'Est. net' ? 'font-semibold text-green-400' : 'text-white'}>{formatMoney(row.amount)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[10px] text-gray-500 mt-3">{data.disclaimer}</p>
    </div>
  );
}
