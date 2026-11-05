import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import PortalSquarePayment from '../../components/cxdashboard/PortalSquarePayment';

/**
 * Public pay page: /pay/{token}
 *
 * Renders the same invoice the PDF shows (backend: pay_link_service → work_order_to_invoice)
 * and charges the balance through the existing Square card form. Square plan option A.
 */

const CYAN = '#00D4FF';
const AMBER = '#FFA62B';
const GREEN = '#34D399';
const PAGE_BG = '#0A0F1E';
const CARD_BG = '#0D1525';
const CHAMFER = 12;

const chamferClip = (size = CHAMFER) =>
  `polygon(${size}px 0, 100% 0, 100% calc(100% - ${size}px), calc(100% - ${size}px) 100%, 0 100%, 0 ${size}px)`;

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function dash(v) {
  const s = v == null ? '' : String(v).trim();
  return s && s !== '—' ? s : '—';
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Chamfered panel like the PDF: 1px accent edge, cut top-left / bottom-right corners. */
function Panel({ title, accent = CYAN, className = '', children }) {
  return (
    <section
      className={className}
      style={{ clipPath: chamferClip(), background: `${accent}59`, padding: 1 }}
    >
      <div style={{ clipPath: chamferClip(), background: CARD_BG }} className="h-full px-4 pb-4 pt-3">
        {title ? (
          <h2
            className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-right text-gray-100">{dash(value)}</span>
    </div>
  );
}

function StatusChip({ tone, children }) {
  const color = tone === 'paid' ? GREEN : tone === 'muted' ? '#9CA3AF' : AMBER;
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.16em]"
      style={{ color, border: `1px solid ${color}`, background: `${color}14` }}
    >
      {children}
    </span>
  );
}

function LineStatus({ label }) {
  if (!label || label === '—') return null;
  const key = String(label).toLowerCase();
  const tone = key === 'paid' || key === 'installed' ? 'paid' : key === 'waived' || key === 'estimated' ? 'muted' : 'due';
  const color = tone === 'paid' ? GREEN : tone === 'muted' ? '#9CA3AF' : AMBER;
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
      {label}
    </span>
  );
}

function ServicesPanel({ services, subtotal }) {
  if (!services?.length) return null;
  return (
    <Panel title="Services">
      <div className="hidden grid-cols-[1fr_3rem_5.5rem_5.5rem] gap-2 border-b border-white/10 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 sm:grid">
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit</span>
        <span className="text-right">Total</span>
      </div>
      <ul className="divide-y divide-white/5">
        {services.map((s, i) => (
          <li key={`${s.name}-${i}`} className="py-2 sm:grid sm:grid-cols-[1fr_3rem_5.5rem_5.5rem] sm:items-baseline sm:gap-2">
            <div className="flex items-baseline justify-between gap-3 sm:block">
              <span className="text-sm text-gray-100">{s.name}</span>
              <span className="text-sm font-semibold text-white sm:hidden">{money(s.total)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400 sm:hidden">
              <span>
                {s.qty} × {money(s.unit_price)}
              </span>
              <LineStatus label={s.billing_status} />
            </div>
            <span className="hidden text-right text-sm text-gray-300 sm:block">{s.qty}</span>
            <span className="hidden text-right text-sm text-gray-300 sm:block">{money(s.unit_price)}</span>
            <span className="hidden text-right text-sm font-semibold text-white sm:block">
              {money(s.total)}
              <span className="block">
                <LineStatus label={s.billing_status} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between border-t border-white/10 pt-2 text-sm">
        <span className="text-gray-400">Services subtotal</span>
        <span className="font-semibold text-white">{money(subtotal)}</span>
      </div>
    </Panel>
  );
}

function PartsPanel({ parts, subtotal }) {
  if (!parts?.length) return null;
  return (
    <Panel title="Parts" accent={AMBER}>
      <ul className="divide-y divide-white/5">
        {parts.map((p, i) => (
          <li key={`${p.part_number}-${i}`} className="flex items-baseline justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="text-sm text-gray-100">{p.description}</div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                <span className="font-mono">{p.part_number}</span>
                <LineStatus label={p.status} />
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-white">{money(p.price)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between border-t border-white/10 pt-2 text-sm">
        <span className="text-gray-400">Parts subtotal</span>
        <span className="font-semibold text-white">{money(subtotal)}</span>
      </div>
    </Panel>
  );
}

function TotalsPanel({ totals }) {
  const t = totals || {};
  const paidInFull = Number(t.balance_due || 0) <= 0.01 && Number(t.amount_paid || 0) > 0;
  const row = (label, value, accent) => (
    <div className="flex justify-between py-0.5 text-sm">
      <span style={{ color: accent || '#9CA3AF' }}>{label}</span>
      <span className="text-gray-100">{value}</span>
    </div>
  );
  const balanceColor = paidInFull ? GREEN : AMBER;
  return (
    <Panel title="Totals">
      {row('Services subtotal', money(t.service_subtotal))}
      {row('Parts subtotal', money(t.parts_subtotal))}
      {row('Subtotal', money(t.subtotal))}
      {row(t.tax_label || 'Sales tax', money(t.tax))}
      {row('Gross total', money(t.gross_total))}
      {Number(t.discount) > 0 ? row('Diagnostic discount', `−${money(t.discount)}`, CYAN) : null}
      <div className="my-2 flex items-center justify-between">
        <span className="text-sm font-bold tracking-[0.12em]" style={{ color: CYAN }}>
          TOTAL
        </span>
        <span
          className="rounded px-2 py-0.5 text-sm font-bold text-white"
          style={{ border: `1px solid ${CYAN}`, background: `${CYAN}14` }}
        >
          {money(t.total)}
        </span>
      </div>
      {row('Amount previously paid', money(t.amount_paid))}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold tracking-[0.12em]" style={{ color: balanceColor }}>
          {paidInFull ? 'PAID IN FULL' : 'BALANCE DUE'}
        </span>
        <span
          className="rounded px-2 py-0.5 text-sm font-bold text-white"
          style={{ border: `1px solid ${balanceColor}`, background: `${balanceColor}14` }}
        >
          {money(t.balance_due)}
        </span>
      </div>
    </Panel>
  );
}

function PaymentsPanel({ payments }) {
  if (!payments?.length) return null;
  const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return (
    <Panel title="Payments received">
      <ul className="divide-y divide-white/5">
        {payments.map((p, i) => (
          <li key={`${p.date}-${i}`} className="flex justify-between gap-3 py-1.5 text-sm">
            <span className="text-gray-300">
              {p.date} <span className="text-gray-500">· {p.method}</span>
            </span>
            <span className="text-gray-100">{money(p.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between border-t border-white/10 pt-2 text-sm">
        <span style={{ color: CYAN }}>Total received</span>
        <span className="font-semibold text-white">{money(total)}</span>
      </div>
    </Panel>
  );
}

function PaySection({ token, data, onPaid }) {
  const squareRef = useRef(null);
  const idempotencyKeyRef = useRef(newIdempotencyKey());
  const [formReady, setFormReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  const amount = Number(data.amount_due || 0);
  const square = data.square || {};

  const submit = useCallback(
    async (sourceId) => {
      const res = await fetch(`/api/public/pay/${encodeURIComponent(token)}/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          square_source_id: sourceId,
          payment_idempotency_key: idempotencyKeyRef.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // New key for the next attempt; a declined card shouldn't replay the same request.
        idempotencyKeyRef.current = newIdempotencyKey();
        throw new Error(body.detail || 'Payment could not be completed.');
      }
      onPaid?.(body);
    },
    [token, amount, onPaid],
  );

  const payWithCard = async () => {
    setError(null);
    if (!squareRef.current?.isReady?.()) {
      setError('Payment form is still loading. Please wait a moment and try again.');
      return;
    }
    setPaying(true);
    try {
      const sourceId = await squareRef.current.tokenize();
      await submit(sourceId);
    } catch (err) {
      setError(err.message || 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  const payWithWallet = useCallback(
    async (sourceId) => {
      setError(null);
      setPaying(true);
      try {
        await submit(sourceId);
      } catch (err) {
        setError(err.message || 'Payment failed.');
        throw err;
      } finally {
        setPaying(false);
      }
    },
    [submit],
  );

  if (!square.configured) {
    return (
      <Panel title="Pay online" accent={AMBER}>
        <p className="text-sm text-gray-300">
          Online payment isn't available right now. Please call {data.invoice?.company?.phone || 'us'} to pay.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Pay online" accent={AMBER}>
      <div className="mb-3 flex items-end justify-between">
        <span className="text-xs uppercase tracking-[0.16em] text-gray-400">Due today</span>
        <span className="text-2xl font-bold text-white">{money(amount)}</span>
      </div>
      <PortalSquarePayment
        ref={squareRef}
        applicationId={square.application_id}
        locationId={square.location_id}
        environment={square.environment}
        amount={amount}
        amountLabel={`Atomic Repair invoice ${data.invoice?.invoice_number || ''}`.trim()}
        applePayEnabled={data.apple_pay_enabled !== false}
        theme="dark"
        preferDarkCardFields
        onReady={setFormReady}
        onWalletToken={payWithWallet}
        disabled={paying}
      />
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={payWithCard}
        disabled={paying || !formReady}
        className="mt-4 w-full rounded-lg py-3 text-base font-bold transition-opacity"
        style={{
          background: GREEN,
          color: PAGE_BG,
          opacity: paying || !formReady ? 0.55 : 1,
          cursor: paying || !formReady ? 'not-allowed' : 'pointer',
        }}
      >
        {paying ? 'Processing…' : `Pay ${money(amount)}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-gray-500">Secure card processing by Square</p>
    </Panel>
  );
}

function PaidBanner({ receipt }) {
  return (
    <Panel accent={GREEN}>
      <div className="py-1 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GREEN }}>
          Payment received
        </div>
        <div className="mt-1 text-lg font-semibold text-white">
          {receipt?.amount ? `${money(receipt.amount)} — thank you!` : 'This invoice is paid in full. Thank you!'}
        </div>
        {receipt?.receipt_url ? (
          <a
            href={receipt.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="mt-2 inline-block text-sm underline"
            style={{ color: CYAN }}
          >
            View your card receipt
          </a>
        ) : null}
      </div>
    </Panel>
  );
}

/** Expired (paid a while ago) or canceled links: no customer, line items or totals. */
function HiddenDetails({ state, phone }) {
  const canceled = state === 'canceled';
  return (
    <Panel accent={canceled ? AMBER : GREEN}>
      <div className="py-2 text-center">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ color: canceled ? AMBER : GREEN }}
        >
          {canceled ? 'Canceled' : 'Paid'}
        </div>
        <div className="mt-1 text-lg font-semibold text-white">
          {canceled ? 'This work order was canceled. Nothing is due.' : 'This invoice is paid in full. Thank you!'}
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Need a copy of your invoice? Call {phone || 'us'}.
        </p>
      </div>
    </Panel>
  );
}

export default function PayInvoicePage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/public/pay/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'This pay link could not be loaded.');
      setData(body);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePaid = useCallback(
    (result) => {
      setReceipt(result);
      load();
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [load],
  );

  const invoice = data?.invoice;
  const state = data?.state;
  const paidInFull = state === 'paid';
  const company = invoice?.company || {};
  const customer = invoice?.customer || {};
  const equipment = invoice?.equipment || {};
  const meta = invoice?.service_meta || {};

  const chip = (() => {
    if (state === 'canceled') return <StatusChip tone="muted">Canceled</StatusChip>;
    if (paidInFull) return <StatusChip tone="paid">Paid in full</StatusChip>;
    return <StatusChip tone="due">Due on receipt</StatusChip>;
  })();

  return (
    <>
      <Head>
        <title>{invoice ? `Invoice ${invoice.invoice_number} · Atomic Repair` : 'Pay invoice · Atomic Repair'}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={PAGE_BG} />
      </Head>

      <main className="min-h-screen px-4 py-6 sm:py-10" style={{ background: PAGE_BG }}>
        <div className="mx-auto w-full max-w-3xl">
          {loadError ? (
            <Panel title="Pay link" accent={AMBER}>
              <p className="text-sm text-gray-300">{loadError}</p>
              <p className="mt-2 text-sm text-gray-400">
                Need help? Call Atomic Repair at (419) 740-0146.
              </p>
            </Panel>
          ) : !data ? (
            <p className="py-20 text-center text-sm text-gray-500">Loading your invoice…</p>
          ) : (
            <div className="space-y-4">
              {/* Header — mirrors the PDF header band */}
              <header
                className="relative overflow-hidden"
                style={{ clipPath: chamferClip(16), background: `${CYAN}59`, padding: 1 }}
              >
                <div
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    clipPath: chamferClip(16),
                    background: `linear-gradient(135deg, ${CARD_BG} 60%, #0B2233)`,
                  }}
                >
                  {/* Same block logo as the PDF header: logo, phone and email are baked in. */}
                  <Image
                    src="/arblockdetailupdate.png"
                    alt="Atomic Repair · (419) 740-0146 · service@atomicrepair419.com"
                    width={0}
                    height={0}
                    sizes="(min-width: 640px) 380px, 90vw"
                    priority
                    className="h-auto w-full sm:w-[380px]"
                  />
                  <div className="sm:text-right">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: CYAN }}>
                      Invoice
                    </div>
                    <div className="font-mono text-xl font-bold text-white">#{invoice.invoice_number}</div>
                    {invoice.date ? <div className="mb-1.5 text-xs text-gray-400">{invoice.date}</div> : <div className="mb-1.5" />}
                    {chip}
                  </div>
                </div>
                {/* laser edge */}
                <div
                  aria-hidden
                  className="absolute bottom-0 left-0 h-px w-full"
                  style={{ background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)` }}
                />
              </header>

              {data.details_hidden ? (
                receipt ? <PaidBanner receipt={receipt} /> : <HiddenDetails state={state} phone={company.phone} />
              ) : (
              <>
              {receipt || paidInFull ? <PaidBanner receipt={receipt} /> : null}

              {state === 'due' && data.square?.configured ? (
                <button
                  type="button"
                  onClick={() => document.getElementById('pay-online')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full rounded-lg py-3 text-base font-bold sm:hidden"
                  style={{ background: GREEN, color: PAGE_BG }}
                >
                  Pay {money(data.amount_due)} ↓
                </button>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <Panel title="Bill to">
                  <div className="text-sm font-semibold text-white">{dash(customer.name)}</div>
                  {customer.address_line1 ? <div className="text-sm text-gray-300">{customer.address_line1}</div> : null}
                  {customer.address_line2 ? <div className="text-sm text-gray-300">{customer.address_line2}</div> : null}
                </Panel>
                <Panel title="Service">
                  <Field label="Technician" value={invoice.technician?.name || meta.technician} />
                  <Field label="Date" value={meta.service_date} />
                  <Field label="Work order" value={meta.work_order} />
                </Panel>
                <Panel title="Equipment" accent={AMBER}>
                  <Field label="Type" value={equipment.subtype} />
                  <Field label="Make" value={equipment.make} />
                  <Field label="Model" value={equipment.model} />
                  <Field label="Serial" value={equipment.serial} />
                </Panel>
              </div>

              <ServicesPanel services={invoice.services} subtotal={invoice.totals?.service_subtotal} />
              <PartsPanel parts={invoice.parts} subtotal={invoice.totals?.parts_subtotal} />

              <div className="grid gap-4 sm:grid-cols-2">
                <PaymentsPanel payments={invoice.payments} />
                <div className={invoice.payments?.length ? '' : 'sm:col-start-2'}>
                  <TotalsPanel totals={invoice.totals} />
                </div>
              </div>

              {state === 'due' ? (
                <div id="pay-online" className="scroll-mt-4">
                  <PaySection token={token} data={data} onPaid={handlePaid} />
                </div>
              ) : null}
              {state === 'call' ? (
                <Panel title="Pay" accent={AMBER}>
                  <p className="text-sm text-gray-300">
                    Your remaining balance is {money(data.amount_due)}, which is below the online minimum.
                    Please call {company.phone || 'us'} to settle up.
                  </p>
                </Panel>
              ) : null}
              </>
              )}

              <footer className="pb-6 pt-2 text-center text-xs text-gray-500">
                Thank you for choosing Atomic Repair · {company.phone} · {company.email}
              </footer>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
