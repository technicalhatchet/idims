import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../utils/api-client';
import PortalSquarePayment from '../cxdashboard/PortalSquarePayment';

export default function WorkOrderSquarePaymentSheet({
  open,
  onClose,
  workOrderId,
  dueToday = 0,
  taxAmount = 0,
  halfDiagnosticDiscount = false,
  onSuccess,
  variant = 'mobile',
}) {
  const squarePaymentRef = useRef(null);
  const [squareConfig, setSquareConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [paymentFormReady, setPaymentFormReady] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setConfigError(null);
    setConfirmError(null);
    setPaymentFormReady(false);
    (async () => {
      try {
        const cfg = await apiClient('work-orders/square-payment-config');
        if (!cancelled) setSquareConfig(cfg);
      } catch (err) {
        if (!cancelled) {
          setConfigError(err.message || 'Could not load payment settings');
          setSquareConfig(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSquareError = useCallback((message) => {
    setConfirmError(message);
  }, []);

  const submitPayment = useCallback(
    async (squareSourceId) => {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`;

      return apiClient(`work-orders/${workOrderId}/square-payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: dueToday,
          tax_amount: taxAmount,
          square_source_id: squareSourceId,
          payment_idempotency_key: idempotencyKey,
          half_diagnostic_discount: halfDiagnosticDiscount,
        }),
      });
    },
    [workOrderId, dueToday, taxAmount, halfDiagnosticDiscount],
  );

  const handleWalletPayment = useCallback(
    async (sourceId) => {
      setConfirmError(null);
      setConfirming(true);
      try {
        const result = await submitPayment(sourceId);
        onSuccess?.(result);
        onClose();
      } catch (err) {
        setConfirmError(err.message || 'Payment failed');
        throw err;
      } finally {
        setConfirming(false);
      }
    },
    [submitPayment, onSuccess, onClose],
  );

  const handlePay = async () => {
    setConfirmError(null);
    if (!squarePaymentRef.current?.isReady?.()) {
      setConfirmError('Payment form is still loading. Please wait a moment and try again.');
      return;
    }
    try {
      const squareSourceId = await squarePaymentRef.current.tokenize();
      setConfirming(true);
      const result = await submitPayment(squareSourceId);
      onSuccess?.(result);
      onClose();
    } catch (err) {
      setConfirmError(err.message || 'Payment failed');
    } finally {
      setConfirming(false);
    }
  };

  if (!open) return null;

  const shellClass =
    variant === 'mobile'
      ? 'fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';

  const panelClass =
    variant === 'mobile'
      ? 'w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0D1525] p-4 pb-6 max-h-[90vh] overflow-y-auto'
      : 'w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto';

  const squareReady = Boolean(squareConfig?.configured);

  return (
    <div className={shellClass} onClick={onClose}>
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        <h3
          className={`text-lg font-semibold mb-1 ${
            variant === 'mobile' ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}
        >
          Pay ${dueToday.toFixed(2)}
        </h3>
        <p
          className={`text-sm mb-4 ${
            variant === 'mobile' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Secure card payment via Square. Billable services and pending appointments update when payment succeeds.
        </p>

        {configError && (
          <p className="text-sm text-red-400 mb-3">{configError}</p>
        )}

        {!configError && squareConfig && !squareReady && (
          <p className="text-sm text-amber-300 mb-3">
            Online card payment is not configured. Use Record payment for cash, check, or Venmo.
          </p>
        )}

        {squareReady && (
          <div className="mb-4">
            <PortalSquarePayment
              ref={squarePaymentRef}
              applicationId={squareConfig.square_application_id}
              locationId={squareConfig.square_location_id}
              environment={squareConfig.square_environment}
              amount={dueToday}
              amountLabel="Balance due"
              applePayEnabled={squareConfig.apple_pay_enabled !== false}
              onError={handleSquareError}
              onReady={setPaymentFormReady}
              onWalletToken={handleWalletPayment}
              disabled={confirming}
            />
            {!paymentFormReady && (
              <p className="text-xs text-gray-500 mt-2">Loading secure card form…</p>
            )}
          </div>
        )}

        {confirmError && (
          <p className="text-sm text-red-400 mb-3">{confirmError}</p>
        )}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className={
              variant === 'mobile'
                ? 'flex-1 h-11 rounded-xl border border-white/15 text-gray-300 text-sm font-medium'
                : 'flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm'
            }
          >
            Cancel
          </button>
          {squareReady && (
            <button
              type="button"
              onClick={handlePay}
              disabled={confirming || !paymentFormReady}
              className={
                variant === 'mobile'
                  ? 'flex-1 h-11 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50'
                  : 'flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium disabled:opacity-50'
              }
            >
              {confirming ? 'Processing…' : `Pay $${dueToday.toFixed(2)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
