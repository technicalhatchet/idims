import { useState } from 'react';
import { apiClient } from '../../utils/api-client';
import toast from 'react-hot-toast';

/**
 * Approve / deny a pending portal same-day scheduling request on a work order.
 */
export default function PortalSchedulingApprovalBar({ workOrder, onUpdated }) {
  const meta = workOrder?.portal_scheduling_meta;
  const pending = meta?.type === 'scheduling_request' && meta?.status === 'pending';

  const [busy, setBusy] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  if (!pending) return null;

  const tier = meta?.service_tier || 'standard';
  const windowName = meta?.time_window || '';
  const requestedDate = meta?.requested_date || '';

  async function approve() {
    setBusy(true);
    try {
      await apiClient(`/api/work-orders/${workOrder.id}/portal-scheduling/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Request approved — appointment scheduled');
      onUpdated?.();
    } catch (err) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setBusy(false);
    }
  }

  async function deny() {
    setBusy(true);
    try {
      await apiClient(`/api/work-orders/${workOrder.id}/portal-scheduling/deny`, {
        method: 'POST',
        body: JSON.stringify({ reason: denyReason.trim() || undefined }),
      });
      toast.success('Request denied — work order stays open; client can pick another day');
      setDenyOpen(false);
      onUpdated?.();
    } catch (err) {
      toast.error(err.message || 'Deny failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
      }}
    >
      <p className="text-amber-200 text-sm font-semibold mb-1">Portal scheduling approval needed</p>
      <p className="text-gray-400 text-xs mb-3">
        {tier !== 'standard' ? `${tier} tier · ` : 'Same-day · '}
        {requestedDate}
        {windowName ? ` · ${windowName}` : ''}
        {meta?.estimated_total != null ? ` · ~$${Number(meta.estimated_total).toFixed(2)}` : ''}
      </p>
      {denyOpen ? (
        <div className="space-y-2">
          <textarea
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder="Optional reason for the client"
            rows={2}
            className="w-full text-sm rounded-lg px-3 py-2 bg-gray-900 border border-gray-700 text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={deny}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
            >
              Confirm deny
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDenyOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={approve}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold"
          >
            Approve &amp; schedule
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDenyOpen(true)}
            className="flex-1 py-2.5 rounded-lg border border-red-500/50 text-red-300 text-sm font-semibold"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}
