const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Whole-cent money for portal display (avoids float artifacts). */
export function roundPortalMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Client-facing money (matches invoice page totals). */
export function formatPortalCurrency(amount) {
  const n = roundPortalMoney(amount);
  if (n == null) return '—';
  return usdFormatter.format(n);
}
