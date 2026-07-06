import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Minimal Square Web Payments card form for portal booking.
 */
const PortalSquarePayment = forwardRef(function PortalSquarePayment(
  { applicationId, locationId, environment = 'sandbox', onError, disabled = false },
  ref,
) {
  const containerRef = useRef(null);
  const cardInstanceRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      if (!cardInstanceRef.current) {
        throw new Error('Payment form is not ready');
      }
      setLoading(true);
      try {
        const result = await cardInstanceRef.current.tokenize();
        if (result.status !== 'OK') {
          const msg = result.errors?.[0]?.message || 'Card could not be verified';
          throw new Error(msg);
        }
        return result.token;
      } finally {
        setLoading(false);
      }
    },
  }));

  useEffect(() => {
    if (!applicationId || !locationId) return undefined;

    const scriptId = 'square-web-payments-sdk';
    const init = async () => {
      if (!window.Square) return;
      try {
        const payments = window.Square.payments(applicationId, locationId);
        const card = await payments.card();
        await card.attach(containerRef.current);
        cardInstanceRef.current = card;
        setReady(true);
      } catch (err) {
        onError?.(err.message || 'Could not load payment form');
      }
    };

    const existing = document.getElementById(scriptId);
    if (existing) {
      init();
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = environment === 'production'
        ? 'https://web.squarecdn.com/v1/square.js'
        : 'https://sandbox.web.squarecdn.com/v1/square.js';
      script.async = true;
      script.onload = init;
      script.onerror = () => onError?.('Failed to load Square payment SDK');
      document.body.appendChild(script);
    }

    return () => {
      cardInstanceRef.current?.destroy?.();
      cardInstanceRef.current = null;
      setReady(false);
    };
  }, [applicationId, locationId, environment, onError]);

  if (!applicationId || !locationId) {
    return (
      <p style={{ color: '#f59e0b', fontSize: '0.875rem' }}>
        Online payment is not configured yet. Please call (419) 515-3394 to schedule.
      </p>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          minHeight: '56px',
          background: '#0a0f1a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px',
          padding: '0.5rem',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      />
      {!ready && (
        <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>Loading secure payment form…</p>
      )}
      {loading && (
        <p style={{ color: '#22d3ee', fontSize: '0.75rem', marginTop: '0.5rem' }}>Processing card…</p>
      )}
    </div>
  );
});

export default PortalSquarePayment;
