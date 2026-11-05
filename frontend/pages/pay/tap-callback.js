import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

/**
 * Square Point of Sale API web callback (Tap to Pay hand-back).
 * Register this exact URL in Square Developer Console → Point of Sale API → Web callback URL:
 *   https://idims.atomicrepair419.com/pay/tap-callback
 *
 * iOS sends ?data={json}; Android sends com.squareup.pos.* query params.
 * Public on purpose: iPhone opens it in Safari, which doesn't share TechDeck's login.
 * The backend trusts only the signed `state` and what Square's API says about the payment.
 */

const CYAN = '#00D4FF';
const GREEN = '#34D399';
const AMBER = '#FFA62B';
const RED = '#F87171';

const CANCEL_CODES = new Set(['payment_canceled', 'TRANSACTION_CANCELED', 'com.squareup.pos.ERROR_TRANSACTION_CANCELED']);

const ERROR_TEXT = {
  not_logged_in: 'The Square app isn’t signed in. Sign in to Square and try again.',
  USER_NOT_LOGGED_IN: 'The Square app isn’t signed in. Sign in to Square and try again.',
  no_network_connection: 'The Square app had no internet connection.',
  NO_NETWORK: 'The Square app had no internet connection.',
  client_not_authorized_for_user: 'This Square app isn’t authorized for your Square account (check the Application ID in Settings).',
  UNAUTHORIZED_CLIENT_ID: 'This Square app isn’t authorized for your Square account (check the Application ID in Settings).',
  unsupported_api_version: 'Update the Square Point of Sale app and try again.',
  UNSUPPORTED_API_VERSION: 'Update the Square Point of Sale app and try again.',
  amount_too_small: 'Square won’t take an amount that small.',
  user_id_mismatch: 'The Square app is signed into a different account or location.',
  ILLEGAL_LOCATION_ID: 'The Square app is signed into a different location.',
};

function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
}

/** Normalize both platforms' callback shapes. */
function parseCallback(query) {
  if (query.data) {
    try {
      const d = JSON.parse(String(query.data));
      return {
        transactionId: d.transaction_id || null,
        clientTransactionId: d.client_transaction_id || null,
        errorCode: d.status === 'ok' ? null : d.error_code || (d.transaction_id ? null : 'unknown'),
        errorDescription: null,
        state: d.state || null,
      };
    } catch {
      return { errorCode: 'data_invalid' };
    }
  }
  const q = (k) => (query[`com.squareup.pos.${k}`] ? String(query[`com.squareup.pos.${k}`]) : null);
  return {
    transactionId: q('SERVER_TRANSACTION_ID'),
    clientTransactionId: q('CLIENT_TRANSACTION_ID'),
    errorCode: q('ERROR_CODE'),
    errorDescription: q('ERROR_DESCRIPTION'),
    state: q('REQUEST_METADATA'),
  };
}

export default function TapToPayCallbackPage() {
  const router = useRouter();
  const sent = useRef(false);
  const [view, setView] = useState({ kind: 'working' });

  useEffect(() => {
    if (!router.isReady || sent.current) return;
    sent.current = true;
    const cb = parseCallback(router.query);

    if (cb.errorCode) {
      const code = String(cb.errorCode).replace('com.squareup.pos.ERROR_', '');
      if (CANCEL_CODES.has(cb.errorCode) || CANCEL_CODES.has(code)) {
        setView({ kind: 'canceled' });
      } else {
        setView({
          kind: 'error',
          message: ERROR_TEXT[cb.errorCode] || ERROR_TEXT[code] || cb.errorDescription || `Square returned: ${cb.errorCode}`,
          charged: false,
        });
      }
      return;
    }

    if (!cb.transactionId) {
      // Offline Mode: Square stored the payment and will process it later.
      setView({
        kind: 'pending',
        message: 'Square took this payment in Offline Mode. It isn’t confirmed yet — record it on the job once it shows in Square.',
      });
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/public/pay/tap-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: cb.state, transaction_id: cb.transactionId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.detail || 'Couldn’t record the payment.');
        setView({ kind: 'done', result: body });
      } catch (err) {
        setView({
          kind: 'error',
          message: `${err.message} The card was charged in Square (transaction ${cb.transactionId}).`,
          charged: true,
        });
      }
    })();
  }, [router.isReady, router.query]);

  const backHref = view.result?.work_order_id ? `/techboard/work-orders/${view.result.work_order_id}` : '/techboard';

  let accent = CYAN;
  let title = 'Recording payment…';
  let body = 'Checking the payment with Square.';
  if (view.kind === 'done') {
    accent = GREEN;
    title = view.result.already_recorded ? 'Already recorded' : `${money(view.result.amount)} recorded`;
    body = `Work order #${view.result.order_number} — balance now ${money(view.result.balance_due)}.`;
  } else if (view.kind === 'canceled') {
    accent = AMBER;
    title = 'Canceled';
    body = 'Nothing was charged.';
  } else if (view.kind === 'pending') {
    accent = AMBER;
    title = 'Pending in Square';
    body = view.message;
  } else if (view.kind === 'error') {
    accent = view.charged ? AMBER : RED;
    title = view.charged ? 'Charged, but not recorded' : 'Tap to Pay didn’t go through';
    body = view.message;
  }

  return (
    <>
      <Head>
        <title>Tap to Pay · TechDeck</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="flex min-h-screen items-center justify-center px-4" style={{ background: '#0A0F1E' }}>
        <div
          className="w-full max-w-sm rounded-2xl p-6 text-center"
          style={{ background: '#0D1525', border: `1px solid ${accent}66` }}
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            Tap to Pay
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>
          <p className="mt-2 text-sm text-gray-300">{body}</p>
          {view.result?.warning ? <p className="mt-3 text-sm" style={{ color: AMBER }}>{view.result.warning}</p> : null}
          {view.kind !== 'working' ? (
            <>
              <p className="mt-5 text-xs text-gray-500">You can switch back to TechDeck now.</p>
              <a
                href={backHref}
                className="mt-3 inline-block w-full rounded-lg py-3 text-sm font-bold"
                style={{ background: accent, color: '#0A0F1E' }}
              >
                Open the work order here
              </a>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
