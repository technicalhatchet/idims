/**
 * Awaiting Pay helpers: money labels, age colors and the "Texted 3d ago" line.
 * Shared by the dashboard tile/panel and /techboard/awaiting-payment.
 */

export function formatMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Whole dollars for the tile ("$1,026"). */
export function formatMoneyShort(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

/** cyan under a week, orange from 7 days, red at 30. */
export function ageTone(days) {
  const d = Number(days) || 0;
  if (d >= 30) return { color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', hot: true };
  if (d >= 7) return { color: '#FB923C', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.35)', hot: false };
  return { color: '#22D3EE', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.22)', hot: false };
}

export function ageLabel(days) {
  const d = Number(days) || 0;
  return d === 0 ? 'TODAY' : `${d}D OPEN`;
}

const SEND_VERB = {
  text: 'Texted',
  email: 'Emailed',
  copy: 'Link copied',
  qr: 'QR shown',
};

function daysBetween(then, now) {
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86400000);
}

/** "Texted 3d ago", "Emailed today", "Link not sent yet". */
export function lastSendLabel(lastSend, now = new Date()) {
  if (!lastSend?.sent_at) return 'Link not sent yet';
  const at = new Date(lastSend.sent_at);
  if (Number.isNaN(at.getTime())) return 'Link not sent yet';
  const verb = SEND_VERB[lastSend.channel] || 'Sent';
  const d = Math.max(0, daysBetween(at, now));
  if (d === 0) return `${verb} today`;
  if (d === 1) return `${verb} yesterday`;
  return `${verb} ${d}d ago`;
}

/** Tile sub-line: "5 jobs" (the money takes the room; 30+ day jobs show red in the panel). */
export function awaitingSummary(data) {
  const n = Number(data?.count) || 0;
  return `${n} job${n === 1 ? '' : 's'}`;
}

export function filterByAge(items, age) {
  const list = items || [];
  if (age === '30') return list.filter((i) => (Number(i.days_open) || 0) >= 30);
  if (age === '7') return list.filter((i) => (Number(i.days_open) || 0) >= 7);
  return list;
}

export function sortAwaiting(items, sort) {
  const list = (items || []).slice();
  if (sort === 'largest') return list.sort((a, b) => (b.balance_due || 0) - (a.balance_due || 0));
  return list.sort((a, b) => (b.days_open || 0) - (a.days_open || 0) || (b.balance_due || 0) - (a.balance_due || 0));
}

/** Text to the customer from the tech's Messages app (same wording as the pay sheet). */
export function payLinkSmsUrl(item) {
  if (!item?.phone || !item?.pay_url) return null;
  const amount = Number.isFinite(Number(item.balance_due)) ? ` — $${Number(item.balance_due).toFixed(2)}` : '';
  const body = `Atomic Repair invoice #${item.order_number}${amount}. Pay here: ${item.pay_url}`;
  return `sms:${item.phone}?&body=${encodeURIComponent(body)}`;
}
