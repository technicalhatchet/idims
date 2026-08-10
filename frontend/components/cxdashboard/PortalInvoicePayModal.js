import { useCallback, useEffect, useRef, useState } from 'react';
import PortalSquarePayment from './PortalSquarePayment';

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

export default function PortalInvoicePayModal({ invoice, token, onClose, onSuccess }) {
  const squarePaymentRef = useRef(null);
  const [schedulingConfig, setSchedulingConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [paymentFormReady, setPaymentFormReady] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const balanceDue = Number(invoice?.balance_due ?? 0);
  const squarePublic = schedulingConfig?.square || {};
  const squareReady = Boolean(
    squarePublic.credentials_configured
    || squarePublic.configured
    || (squarePublic.square_application_id && squarePublic.square_location_id)
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
      return portalFetch(`work-orders/${invoice.id}/pay-invoice`, token, {
        method: 'POST',
        body: JSON.stringify({
          amount: balanceDue,
          square_source_id: squareSourceId,
          payment_idempotency_key: idempotencyKey,
        }),
      });
    },
    [invoice?.id, token, balanceDue],
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

  if (!invoice) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '28rem',
          background: '#0D1525',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '1.25rem',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
          Pay Invoice #{invoice.order_number}
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1rem' }}>
          Balance due: <strong style={{ color: '#22d3ee' }}>${balanceDue.toFixed(2)}</strong>
        </p>

        {configError && (
          <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{configError}</p>
        )}

        {squareReady ? (
          <PortalSquarePayment
            ref={squarePaymentRef}
            applicationId={squarePublic.square_application_id}
            locationId={squarePublic.square_location_id}
            environment={squarePublic.square_environment}
            amount={balanceDue}
            amountLabel={`Invoice ${invoice.order_number}`}
            applePayEnabled={applePayEnabled}
            theme="dark"
            onError={setConfirmError}
            onReady={setPaymentFormReady}
            onWalletToken={handleWalletPayment}
            disabled={confirming}
          />
        ) : (
          !configError && (
            <p style={{ color: '#f59e0b', fontSize: '0.875rem' }}>
              Online payment is not available. Please call (419) 794-1689.
            </p>
          )
        )}

        {confirmError && (
          <p style={{ color: '#f87171', fontSize: '0.8125rem', marginTop: '0.75rem' }}>{confirmError}</p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: '#9ca3af',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {squareReady && (
            <button
              type="button"
              onClick={handlePay}
              disabled={confirming || !paymentFormReady}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '8px',
                border: 'none',
                background: '#22c55e',
                color: '#0a0f1a',
                fontWeight: 700,
                cursor: confirming || !paymentFormReady ? 'not-allowed' : 'pointer',
                opacity: confirming || !paymentFormReady ? 0.55 : 1,
              }}
            >
              {confirming ? 'Processing…' : `Pay $${balanceDue.toFixed(2)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
