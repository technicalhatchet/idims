import { useJobEconomics } from '../../hooks/useJobEconomicsReferenceData';
import { formatMoney } from './WorkOrderExpensesPanel';

export default function JobEconomicsCard({ workOrderId, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  const { data, isLoading, error } = useJobEconomics(workOrderId);

  if (isLoading && !data) {
    return <p className="text-xs text-gray-500">Loading job economics…</p>;
  }
  if (error && !data) {
    return <p className="text-xs text-amber-400">{error.message || 'Unable to load job economics'}</p>;
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
      <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">{data.disclaimer}</p>
      <p className="text-[10px] text-gray-500 mt-1">
        Parts cost is derived from part lines — not from job expenses below.
      </p>
    </div>
  );
}
