import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PortalSquarePayment from './PortalSquarePayment';
import {
  formatPortalInvoiceBulkLine,
  getPortalPayableInvoices,
} from '../../utils/portalWorkOrderDisplay';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

async function portalFetch(endpoint, token, options = {}) {
  const impersonateId = typeof window !== 'undefined'
    ? sessionStorage.getItem('portal_impersonate_client_id')
    : null;
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = impersonateId
    ? `${BACKEND}/api/portal/${endpoint}${sep}admin_client_id=${impersonateId}`
    : `${BACKEND}/api/portal/${endpoint}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.detail || data.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function PortalInvoicePayAllModal({ invoices = [], token, onClose, onSuccess }) {
  const squarePaymentRef = useRef(null);
  const [schedulingConfig, setSchedulingConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [paymentFormReady, setPaymentFormReady] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const payable = useMemo(() => getPortalPayableInvoices(invoices), [invoices]);
  const totalDue = useMemo(
    () => payable.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0),
    [payable],
  );

  const squarePublic = schedulingConfig?.square || {};
  const squareReady = Boolean(
    squarePublic.credentials_configured
    || squarePublic.configured
    || (squarePublic.square_application_id && squarePublic.square_location_id),
  );
  const applePayEnabled = schedulingConfig?.apple_pay_enabled !== false && squareReady;

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await portalFetch('scheduling-config', token);
        if (!cancelled) setSchedulingConfig(cfg);
      } catch (err) {
        if (!cancelled) setConfigError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const submitPayment = useCallback(
    async (squareSourceId) => {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`;
      return portalFetch('invoices/pay-all', token, {
        method: 'POST',
        body: JSON.stringify({
          square_source_id: squareSourceId,
          payment_idempotency_key: idempotencyKey,
          work_order_ids: payable.map((inv) => inv.id),
        }),
      });
    },
    [payable, token],
  );

  const handleWalletPayment = useCallback(async (sourceId) => {
    setConfirmError(null);
    setConfirming(true);
    try {
      await submitPayment(sourceId);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setConfirmError(err.message);
      throw err;
    } finally {
      setConfirming(false);
    }
  }, [submitPayment, onSuccess, onClose]);

  const handlePay = async () => {
    setConfirmError(null);
    if (!squarePaymentRef.current?.isReady?.()) {
      setConfirmError('Payment form is still loading. Please wait and try again.');
      return;
    }
    try {
      const squareSourceId = await squarePaymentRef.current.tokenize();
      setConfirming(true);
      await submitPayment(squareSourceId);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setConfirmError(err.message || 'Payment failed');
    } finally {
      setConfirming(false);
    }
  };

  if (!payable.length) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-all-title"
      className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0D1525] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pay-all-title" className="text-white text-lg font-bold m-0">
          Pay all outstanding invoices
        </h2>
        <p className="text-white/50 text-sm mt-1 mb-4">
          One payment covers every invoice below. Each invoice will receive the same payment note
          listing all included orders.
        </p>

        <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
          {payable.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between gap-3 text-sm py-2 border-b border-white/[0.06] last:border-0"
            >
              <span className="text-white/80 min-w-0 truncate">
                {formatPortalInvoiceBulkLine(inv)}
              </span>
              <span className="text-cyan-400 font-semibold tabular-nums shrink-0">
                ${Number(inv.balance_due).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between py-3 border-t border-white/[0.08] mb-4">
          <span className="text-white/60 text-sm font-medium">Total due</span>
          <span className="text-xl font-bold text-white tabular-nums">
            ${totalDue.toFixed(2)}
          </span>
        </div>

        {configError && (
          <p className="text-red-400 text-sm">{configError}</p>
        )}

        {squareReady ? (
          <PortalSquarePayment
            ref={squarePaymentRef}
            applicationId={squarePublic.square_application_id}
            locationId={squarePublic.square_location_id}
            environment={squarePublic.square_environment}
            amount={totalDue}
            amountLabel={`${payable.length} invoice${payable.length === 1 ? '' : 's'}`}
            applePayEnabled={applePayEnabled}
            theme="dark"
            onError={setConfirmError}
            onReady={setPaymentFormReady}
            onWalletToken={handleWalletPayment}
            disabled={confirming}
          />
        ) : (
          !configError && (
            <p className="text-amber-400 text-sm">
              Online payment is not available. Please call (419) 794-1689.
            </p>
          )
        )}

        {confirmError && (
          <p className="text-red-400 text-xs mt-3">{confirmError}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="flex-1 py-3 rounded-lg border border-white/15 text-white/60 font-semibold text-sm"
          >
            Cancel
          </button>
          {squareReady && (
            <button
              type="button"
              onClick={handlePay}
              disabled={confirming || !paymentFormReady}
              className="flex-1 py-3 rounded-lg bg-emerald-500 text-[#0a0f1a] font-bold text-sm disabled:opacity-50"
            >
              {confirming ? 'Processing…' : `Pay $${totalDue.toFixed(2)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
