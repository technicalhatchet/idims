import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { SQUARE_CARD_STYLE_DARK, SQUARE_CARD_STYLE_LIGHT, SQUARE_CARD_STYLE_ON_DARK_PAGE } from './squareCardStyles';

let squareScriptPromise = null;

function loadSquareScript(environment) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Square SDK requires a browser'));
  }
  if (window.Square) {
    return Promise.resolve();
  }
  if (squareScriptPromise) {
    return squareScriptPromise;
  }

  squareScriptPromise = new Promise((resolve, reject) => {
    const scriptId = 'square-web-payments-sdk';
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Square SDK')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      squareScriptPromise = null;
      reject(new Error('Failed to load Square payment SDK'));
    };
    document.body.appendChild(script);
  });

  return squareScriptPromise;
}

function formatMoneyAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return null;
  return value.toFixed(2);
}

/**
 * Square card + Apple Pay for portal booking.
 */
const PortalSquarePayment = forwardRef(function PortalSquarePayment(
  {
    applicationId,
    locationId,
    environment = 'sandbox',
    amount = null,
    amountLabel = 'Estimated total',
    applePayEnabled = true,
    onError,
    onReady,
    onWalletToken,
    disabled = false,
    /** 'dark' = dark page chrome with readable light card fields; 'light' = light page */
    theme = 'dark',
    /** When true, attempt Square’s true dark inputs (#2d2d2d). Default false — more reliable contrast. */
    preferDarkCardFields = false,
  },
  ref,
) {
  const containerRef = useRef(null);
  const cardInstanceRef = useRef(null);
  const applePayRef = useRef(null);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const onWalletTokenRef = useRef(onWalletToken);
  const [cardReady, setCardReady] = useState(false);
  const [applePayReady, setApplePayReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState(null);

  const moneyAmount = formatMoneyAmount(amount);
  const cardStyle = (() => {
    if (theme === 'light') return SQUARE_CARD_STYLE_LIGHT;
    if (preferDarkCardFields) return SQUARE_CARD_STYLE_DARK;
    return SQUARE_CARD_STYLE_ON_DARK_PAGE;
  })();
  const shellBg = theme === 'light' ? '#ffffff' : '#1f2937';
  const shellBorder = theme === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.12)';

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onReadyRef.current?.(cardReady);
  }, [cardReady]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onWalletTokenRef.current = onWalletToken;
  }, [onWalletToken]);

  useImperativeHandle(
    ref,
    () => ({
      isReady() {
        return cardReady && Boolean(cardInstanceRef.current);
      },
      async tokenize() {
        if (!cardInstanceRef.current) {
          throw new Error('Payment form is still loading. Please wait a moment and try again.');
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
    }),
    [cardReady],
  );

  // Card form — init once per app/location/env
  useEffect(() => {
    if (!applicationId || !locationId) return undefined;

    let cancelled = false;

    async function initCard() {
      setInitError(null);
      setCardReady(false);
      cardInstanceRef.current = null;

      try {
        await loadSquareScript(environment);
        if (cancelled || !containerRef.current || !window.Square) return;

        const payments = window.Square.payments(applicationId, locationId);
        const card = await payments.card({ style: cardStyle });
        if (cancelled || !containerRef.current) {
          await card.destroy?.();
          return;
        }

        await card.attach(containerRef.current);
        if (cancelled) {
          await card.destroy?.();
          return;
        }

        cardInstanceRef.current = card;
        setCardReady(true);
      } catch (err) {
        if (cancelled) return;
        const message = err?.message || 'Could not load payment form';
        setInitError(message);
        onErrorRef.current?.(message);
      }
    }

    initCard();

    return () => {
      cancelled = true;
      const card = cardInstanceRef.current;
      cardInstanceRef.current = null;
      setCardReady(false);
      if (card?.destroy) {
        card.destroy().catch(() => {});
      }
    };
  }, [applicationId, locationId, environment, cardStyle]);

  // Apple Pay — re-init when amount changes
  useEffect(() => {
    if (!applePayEnabled || !applicationId || !locationId || !moneyAmount) {
      setApplePayReady(false);
      applePayRef.current = null;
      return undefined;
    }

    let cancelled = false;

    async function initApplePay() {
      setApplePayReady(false);
      applePayRef.current = null;

      try {
        await loadSquareScript(environment);
        if (cancelled || !window.Square) return;

        const payments = window.Square.payments(applicationId, locationId);
        const paymentRequest = payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: {
            amount: moneyAmount,
            label: amountLabel,
          },
        });
        const applePay = await payments.applePay(paymentRequest);
        if (cancelled) {
          await applePay.destroy?.();
          return;
        }
        applePayRef.current = applePay;
        setApplePayReady(true);
      } catch {
        // Apple Pay unavailable (browser, domain, device) — card still works
        if (!cancelled) {
          setApplePayReady(false);
          applePayRef.current = null;
        }
      }
    }

    initApplePay();

    return () => {
      cancelled = true;
      const applePay = applePayRef.current;
      applePayRef.current = null;
      setApplePayReady(false);
      if (applePay?.destroy) {
        applePay.destroy().catch(() => {});
      }
    };
  }, [applePayEnabled, applicationId, locationId, environment, moneyAmount, amountLabel]);

  const handleApplePayClick = useCallback(async (event) => {
    event.preventDefault();
    if (disabled || !applePayRef.current) return;

    setLoading(true);
    setInitError(null);
    try {
      // tokenize() must be the first async work in the click handler (Apple requirement)
      const result = await applePayRef.current.tokenize();
      if (result.status !== 'OK') {
        const msg = result.errors?.[0]?.message || 'Apple Pay could not be completed';
        throw new Error(msg);
      }
      await onWalletTokenRef.current?.(result.token);
    } catch (err) {
      const message = err?.message || 'Apple Pay failed';
      setInitError(message);
      onErrorRef.current?.(message);
    } finally {
      setLoading(false);
    }
  }, [disabled]);

  if (!applicationId || !locationId) {
    return (
      <p style={{ color: '#f59e0b', fontSize: '0.875rem' }}>
        Online payment is not configured yet. Please call (419) 740-0146 to schedule.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {applePayReady && (
        <button
          type="button"
          onClick={handleApplePayClick}
          disabled={disabled || loading}
          aria-label="Pay with Apple Pay"
          style={{
            width: '100%',
            height: '48px',
            border: 'none',
            borderRadius: '8px',
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            opacity: disabled || loading ? 0.6 : 1,
            WebkitAppearance: '-apple-pay-button',
            applePayButtonType: 'pay',
            applePayButtonStyle: 'black',
          }}
        />
      )}

      {applePayReady && (
        <p style={{ color: '#6b7280', fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>
          or pay with card
        </p>
      )}

      <div
        ref={containerRef}
        className="sq-card-shell"
        style={{
          minHeight: '56px',
          background: shellBg,
          border: shellBorder,
          borderRadius: '8px',
          padding: '0.5rem',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      />
      {!cardReady && !initError && (
        <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
          Loading secure payment form…
        </p>
      )}
      {initError && (
        <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0 }}>{initError}</p>
      )}
      {loading && (
        <p style={{ color: '#22d3ee', fontSize: '0.75rem', margin: 0 }}>Processing payment…</p>
      )}
    </div>
  );
});

export default PortalSquarePayment;
