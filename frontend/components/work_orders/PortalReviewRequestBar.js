import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';

export default function PortalReviewRequestBar({ workOrder, onUpdated }) {
  const [sending, setSending] = useState(false);
  const sentAt = workOrder?.review_requested_at;

  const send = async () => {
    if (!workOrder?.id) return;
    setSending(true);
    try {
      await apiClient(`/api/work-orders/${workOrder.id}/send-review-request?force=true`, {
        method: 'POST',
      });
      toast.success('Review request sent');
      onUpdated?.();
    } catch (err) {
      toast.error(err.message || 'Could not send review request');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
      {sentAt && (
        <span>
          Review requested {new Date(sentAt).toLocaleString()}
        </span>
      )}
      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="text-cyan-400 hover:text-cyan-300 font-medium disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send review request'}
      </button>
    </div>
  );
}
