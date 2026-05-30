import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPropertyServiceHistory } from '../../services/api/jobEconomicsApi';
import { formatMoney } from './WorkOrderExpensesPanel';

function formatEquipment(item) {
  const parts = [item.equipment_make, item.equipment_model, item.equipment_subtype].filter(Boolean);
  return parts.join(' ') || 'Equipment';
}

export default function PropertyServiceHistory({ propertyId, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    getPropertyServiceHistory(propertyId)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (!propertyId) return null;
  if (loading) return <p className="text-xs text-gray-500">Loading service history…</p>;
  if (error) return <p className="text-xs text-red-400">{error}</p>;
  if (!data?.items?.length) return <p className="text-xs text-gray-500">No service history at this property yet.</p>;

  return (
    <div className={`rounded-xl p-4 ${isMobile ? 'border border-cyan-500/20 bg-[#0D1525]' : 'border border-gray-200 dark:border-gray-700'}`}>
      <h3 className={`text-sm font-semibold mb-1 ${isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'}`}>Service history</h3>
      {data.address && <p className="text-xs text-gray-500 mb-3">{data.address}</p>}
      <ul className="space-y-3">
        {data.items.map((item) => (
          <li key={item.work_order_id} className={`text-sm border-b pb-3 last:border-0 ${isMobile ? 'border-white/5' : 'border-gray-100 dark:border-gray-700'}`}>
            <div className="flex justify-between gap-2">
              <Link href={`/work_orders/${item.work_order_id}/mobile`} className="text-cyan-400 hover:underline font-medium">
                {item.order_number || 'Work order'}
              </Link>
              {item.amount_collected != null && (
                <span className="text-xs text-gray-400">{formatMoney(item.amount_collected)}</span>
              )}
            </div>
            <p className={`mt-1 ${isMobile ? 'text-gray-300' : 'text-gray-800 dark:text-gray-200'}`}>{formatEquipment(item)}</p>
            {item.resolution_summary && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.resolution_summary}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
