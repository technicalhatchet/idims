import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  getWorkOrderCloseReadiness,
  closeWorkOrder,
  recloseWorkOrder,
} from '../../services/api/workOrdersApi';

const CHECK_LABELS = {
  has_dma_outcome: 'DMA repair outcome recorded',
  parts_dispositioned: 'All parts marked installed or not installed',
  paid_in_full: 'Paid in full (no outstanding billable SKUs)',
  status_completed: 'Work order status is completed',
  appointments_close_eligible: 'Every visit canceled or completed',
  not_already_closed: 'Not already administratively closed',
  not_immutable_status: 'Work order is not canceled or refunded',
};

export default function WorkOrderCloseModal({
  isOpen,
  onClose,
  workOrderId,
  isClosed,
  onSuccess,
  variant = 'desktop',
}) {
  const isMobile = variant === 'mobile';
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getWorkOrderCloseReadiness(workOrderId)
      .then((data) => {
        if (!cancelled) setReadiness(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load close checklist');
          setReadiness(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, workOrderId]);

  const handleClose = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (isClosed) {
        await recloseWorkOrder(workOrderId);
      } else {
        await closeWorkOrder(workOrderId);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to close work order');
    } finally {
      setSubmitting(false);
    }
  };

  const preview = readiness?.snapshot_preview;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isClosed ? 'Re-close work order' : 'Close work order'}
      size="md"
    >
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Closing locks billing, parts, and scheduling on this order. You can still add notes,
          photos, and mark appointments for redo or refund.
        </p>

        {loading && (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {!loading && readiness && (
          <>
            <ul className="space-y-2">
              {Object.entries(readiness.checks || {})
                .filter(([key]) => {
                  if (key === 'has_dma_outcome' && readiness.dma_outcome_required === false) {
                    return false;
                  }
                  return true;
                })
                .map(([key, ok]) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      ok
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    }`}
                  >
                    {ok ? '✓' : '✗'}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">
                    {CHECK_LABELS[key] || key}
                  </span>
                </li>
              ))}
            </ul>

            {readiness.blockers?.length > 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                  Blockers
                </p>
                <ul className="list-disc list-inside text-sm text-amber-800 dark:text-amber-300 space-y-1">
                  {readiness.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview && (
              <div className="text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1">
                <p>
                  Total after discount:{' '}
                  <strong>${Number(preview.invoice_total || 0).toFixed(2)}</strong>
                </p>
                {preview.diagnostic_discount > 0 && (
                  <p className="text-xs">
                    Diagnostic discount applied:{' '}
                    <strong>${Number(preview.diagnostic_discount).toFixed(2)}</strong>
                  </p>
                )}
                <p>
                  Amount paid:{' '}
                  <strong>${Number(preview.amount_previously_paid || 0).toFixed(2)}</strong>
                </p>
                <p>
                  Balance due:{' '}
                  <strong>${Number(preview.balance_due ?? 0).toFixed(2)}</strong>
                </p>
              </div>
            )}
          </>
        )}

        <div
          className={
            isMobile
              ? 'flex flex-col-reverse gap-2 pt-2'
              : 'flex justify-end gap-2 pt-2'
          }
        >
          <Button
            variant="secondary"
            fullWidth={isMobile}
            size={isMobile ? 'lg' : 'md'}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth={isMobile}
            size={isMobile ? 'lg' : 'md'}
            onClick={handleClose}
            disabled={submitting || loading || !readiness?.can_close}
          >
            {submitting ? 'Saving…' : isClosed ? 'Re-close order' : 'Close order'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
