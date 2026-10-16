const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Client-facing money (matches invoice page totals). */
export function formatPortalCurrency(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return usdFormatter.format(n);
}
