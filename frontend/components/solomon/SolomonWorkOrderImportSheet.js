import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getWorkOrders } from '../../services/api/workOrdersApi';

/**
 * Staff-only sheet to pick a work order for Solomon import.
 */
export default function SolomonWorkOrderImportSheet({
  open,
  onClose,
  onSelect,
  title = 'Import to work order',
  description = 'Creates private Diagnostic Results and Repair Outcome notes on the job.',
  isImporting = false,
  error = null,
}) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getWorkOrders({ page: 1, limit: 50 })
      .then((res) => {
        if (!cancelled) {
          setOrders(res?.items || res?.work_orders || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Failed to load work orders');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((wo) => {
      const parts = [
        wo.order_number,
        wo.description,
        wo.equipment_make,
        wo.equipment_model,
        wo.client_name,
        wo.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return parts.includes(q);
    });
  }, [orders, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#0D1525] border border-white/10 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="font-medium text-white">{title}</p>
              {description ? <p className="text-xs text-gray-400 mt-1">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 shrink-0" aria-label="Close">
              ✕
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order #, client, equipment…"
            className="mt-3 w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
        </div>

        <div className="overflow-y-auto p-2 flex-1 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : loadError ? (
            <p className="text-sm text-red-400 p-4">{loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 p-4 text-center">No matching work orders.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((wo) => (
                <button
                  key={wo.id}
                  type="button"
                  disabled={isImporting}
                  onClick={() => onSelect(wo)}
                  className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-white/5 disabled:opacity-50 border border-transparent hover:border-cyan-500/20"
                >
                  <p className="text-sm font-medium text-white">
                    #{wo.order_number || '—'}
                    {wo.status ? (
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 ml-2">{wo.status}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                    {[wo.equipment_make, wo.equipment_model].filter(Boolean).join(' ')}
                    {wo.description ? ` · ${wo.description}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-red-400 px-4 py-2 border-t border-white/10">{error}</p> : null}

        <div className="p-3 border-t border-white/10 text-center">
          <Link href="/work_orders" className="text-xs text-cyan-400 hover:text-cyan-300">
            Open full work order list →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SolomonImportedWorkOrderLink({ workOrderId, orderNumber }) {
  if (!workOrderId) return null;
  return (
    <Link
      href={`/work_orders/${workOrderId}/mobile?tab=notes`}
      className="text-xs text-emerald-300 hover:text-emerald-200"
    >
      Imported to WO #{orderNumber || 'notes'} →
    </Link>
  );
}
