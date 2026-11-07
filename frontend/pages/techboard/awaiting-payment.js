import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import TechMobileBackDock from '../../components/layouts/TechMobileBackDock';
import WorkOrderPaySheet from '../../components/work_orders/WorkOrderPaySheet';
import { useAwaitingPayment } from '../../hooks/useAwaitingPayment';
import { techWorkOrderDetailPath } from '../../lib/techRoutes';
import { logPayLinkSend, emailWorkOrderInvoice, SQUARE_PAY_FEATURES } from '../../services/api/squarePayApi';
import {
  ageLabel,
  ageTone,
  filterByAge,
  formatMoney,
  lastSendLabel,
  payLinkSmsUrl,
  sortAwaiting,
} from '../../utils/awaitingPayment';

const PAGE_BG = '#0A0F1E';
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const ORBITRON = "'Orbitron', system-ui, sans-serif";
const AGE_CHIPS = [['all', 'All'], ['7', '7+ days'], ['30', '30+ days']];

function ActionButton({ icon, label, onClick, href, disabled }) {
  const cls = 'flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[10px] text-[10px] font-bold tracking-[0.08em] touch-manipulation disabled:opacity-40';
  const style = { border: '1px solid #1F3B55', background: 'rgba(13,22,38,0.85)', color: '#A5F3FC' };
  const inner = (
    <>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
      {label}
    </>
  );
  if (href && !disabled) {
    return <a href={href} onClick={onClick} className={cls} style={style}>{inner}</a>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} className={cls} style={style}>{inner}</button>;
}

function JobRow({ item, open, onToggle, onNotice, onRefetch }) {
  const tone = ageTone(item.days_open);
  const sms = payLinkSmsUrl(item);
  const [emailing, setEmailing] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.pay_url);
      onNotice('PAY LINK // COPIED');
    } catch {
      window.prompt('Copy this pay link:', item.pay_url);
    }
    logPayLinkSend(item.id, 'copy');
    onRefetch();
  };

  const email = async () => {
    setEmailing(true);
    try {
      const res = await emailWorkOrderInvoice(item.id);
      onNotice(`INVOICE // EMAILED${res?.email ? ` TO ${String(res.email).toUpperCase()}` : ''}`);
      onRefetch();
    } catch (err) {
      alert(err?.message || 'Could not email the invoice');
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="relative block w-full overflow-hidden rounded-xl py-3 pl-4 pr-3.5 text-left touch-manipulation"
        style={open
          ? { border: '1px solid rgba(34,211,238,0.6)', background: 'rgba(14,30,48,0.85)', boxShadow: '0 0 16px rgba(34,211,238,0.22)', transform: 'translateY(-1px)', transition: 'all .18s' }
          : { border: '1px solid rgba(34,211,238,0.18)', background: 'rgba(13,21,37,0.55)', transition: 'all .18s' }}
      >
        <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r" style={{ background: tone.color }} />
        <span className="flex items-center justify-between gap-2.5">
          <span className="min-w-0 truncate text-base font-bold text-white">{item.client}</span>
          <span className="shrink-0" style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: '#FDE68A' }}>{formatMoney(item.balance_due)}</span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2.5">
          <span className="min-w-0 truncate text-xs text-[#8FA3B8]">
            <span style={{ fontFamily: MONO, color: '#A5F3FC' }}>{item.order_number}</span> · <span className="capitalize">{item.appliance}</span>
          </span>
          <span className="shrink-0 rounded-full px-2 py-0.5" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', background: tone.bg, color: tone.color }}>
            {ageLabel(item.days_open)}
          </span>
        </span>
        {item.due_later > 0.01 ? (
          <span className="mt-1 block text-xs text-[#60A5FA]">Due later (after repair) {formatMoney(item.due_later)}</span>
        ) : null}
        <span className="mt-1 block text-[11px] text-[#6B7C90]">{lastSendLabel(item.last_send)}</span>
      </button>
      {open ? (
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          <ActionButton
            label="TEXT LINK"
            icon="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            href={sms}
            disabled={!sms}
            onClick={() => { logPayLinkSend(item.id, 'text'); setTimeout(onRefetch, 1500); }}
          />
          <ActionButton
            label={emailing ? 'SENDING…' : 'EMAIL'}
            icon="M4 6h16v12H4zM4 7l8 6 8-6"
            onClick={email}
            disabled={emailing || !SQUARE_PAY_FEATURES.emailInvoice}
          />
          <ActionButton
            label="COPY LINK"
            icon="M9 9h11v11H9zM5 15H4V4h11v1"
            onClick={copy}
          />
          <Link
            href={techWorkOrderDetailPath(item.id)}
            className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[10px] text-[10px] font-bold tracking-[0.08em] touch-manipulation"
            style={{ border: '1px solid #1F3B55', background: 'rgba(13,22,38,0.85)', color: '#A5F3FC' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" /></svg>
            OPEN WO
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function AwaitingPaymentPage() {
  const { data, isLoading, error, refetch } = useAwaitingPayment();
  const [age, setAge] = useState('all');
  const [sort, setSort] = useState('oldest');
  const [openId, setOpenId] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const items = data?.items || [];
  const rows = useMemo(() => sortAwaiting(filterByAge(items, age), sort), [items, age, sort]);
  const picked = items.find((i) => i.id === openId) || null;

  const flash = (text) => {
    setNotice(text);
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setNotice(''), 1800);
  };

  return (
    <>
      <Head>
        <title>Awaiting Pay | IDIMS</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="relative min-h-full px-4 pb-6 pt-3.5" style={{ background: PAGE_BG }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: 0.11, backgroundImage: 'linear-gradient(rgba(0,217,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,255,0.28) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />

        <div className="relative mx-auto max-w-xl">
          <div className="rounded-2xl px-3.5 py-3" style={{ border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(28,24,10,0.55)', boxShadow: '0 0 18px rgba(250,204,21,0.12)' }}>
            <div style={{ fontFamily: ORBITRON, fontSize: 10, letterSpacing: '0.2em', color: '#FDE68A' }}>OUTSTANDING</div>
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="m-0" style={{ fontFamily: ORBITRON, fontWeight: 800, fontSize: 22, letterSpacing: '0.06em', color: '#fff' }}>AWAITING PAY</h1>
              <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#FACC15' }}>{formatMoney(data?.total_due || 0)}</div>
            </div>
            <div className="mt-1 flex justify-between" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: '#8FA3B8' }}>
              <span>{data ? `${data.count} JOB${data.count === 1 ? '' : 'S'} DUE NOW` : '…'}</span>
              <span>{data?.total_later > 0 ? `+${formatMoney(data.total_later)} LATER` : ''}</span>
            </div>
          </div>

          <div role="group" aria-label="Age" className="mt-3 flex gap-1.5">
            {AGE_CHIPS.map(([key, label]) => {
              const on = age === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAge(key)}
                  className="h-[34px] rounded-full px-3 text-xs font-bold whitespace-nowrap touch-manipulation"
                  style={on
                    ? { background: '#22D3EE', color: '#03161C', border: '1px solid #A5F3FC' }
                    : { background: 'rgba(13,22,38,0.8)', color: '#A5F3FC', border: '1px solid #1F3B55' }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            {isLoading ? (
              [0, 1, 2].map((i) => <div key={i} className="mb-2 h-[86px] animate-pulse rounded-xl" style={{ border: '1px solid rgba(34,211,238,0.12)', background: 'rgba(13,21,37,0.5)' }} />)
            ) : error ? (
              <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#FECACA]" style={{ border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.14)' }}>
                <span className="flex-1">Couldn’t load who owes.</span>
                <button type="button" onClick={() => refetch()} className="min-h-[44px] rounded-lg px-3 font-semibold text-[#A5F3FC]" style={{ border: '1px solid #1F3B55' }}>Retry</button>
              </div>
            ) : rows.length === 0 ? (
              <p className="mt-8 text-center text-sm text-[#6B7C90]">{items.length ? 'Nothing in this range.' : 'Nobody owes right now.'}</p>
            ) : (
              rows.map((item) => (
                <JobRow
                  key={item.id}
                  item={item}
                  open={openId === item.id}
                  onToggle={() => setOpenId((cur) => (cur === item.id ? '' : item.id))}
                  onNotice={flash}
                  onRefetch={() => refetch()}
                />
              ))
            )}
          </div>
        </div>

        {notice ? (
          <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center">
            <div style={{ background: '#22D3EE', color: '#06121A', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '5px 12px' }}>{notice}</div>
          </div>
        ) : null}
      </div>

      {picked ? (
        <WorkOrderPaySheet
          open={sheetOpen}
          onClose={() => { setSheetOpen(false); refetch(); }}
          workOrderId={picked.id}
          orderNumber={picked.order_number}
          dueToday={picked.balance_due}
          clientPhone={picked.phone || ''}
          onRefreshBalance={() => refetch()}
          onNotice={flash}
          onEnterCard={() => { window.location.href = techWorkOrderDetailPath(picked.id); }}
          onRecordPayment={() => { window.location.href = techWorkOrderDetailPath(picked.id); }}
        />
      ) : null}

      <TechMobileBackDock
        primary={{
          label: 'Pay Sheet',
          icon: 'card',
          onPress: () => { if (picked) setSheetOpen(true); else flash('PICK A JOB FIRST'); },
        }}
        secondary={{
          label: sort === 'oldest' ? 'Oldest' : 'Largest',
          icon: 'sort',
          onPress: () => setSort((s) => (s === 'oldest' ? 'largest' : 'oldest')),
        }}
      />
    </>
  );
}

AwaitingPaymentPage.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;
