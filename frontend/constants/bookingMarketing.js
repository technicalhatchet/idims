/** Customer-facing copy — does not affect billing logic. */

export const OPENING_SPECIAL_LIST_PRICE = 129;
/** Canonical marketing diagnostic fee — homepage Pricing, /book, and promise copy. */
export const OPENING_SPECIAL_PRICE = 89;

export const DIAGNOSTIC_CREDIT_MARKETING =
  '50% of your diagnostic fee is applied toward the repair if you proceed.';

export const BOOKING_PAYMENT_NOTE =
  'No payment is collected online. We will call you to confirm your appointment date and time and collect payment then.';

/** Marketing line — same-day visit is diagnostic-first, not “parts + repair done” guarantee. */
export const SAME_DAY_DIAGNOSTICS_TAGLINE = 'Same-day diagnostics when available';

/** Shown on /book step 3. */
export const BOOKING_TIMING_NOTE =
  'These options are requests only — we call to confirm your visit. '
  + 'For a guaranteed time slot, log in to the client portal.';

export const BOOKING_REPAIR_NOTE =
  'Many repairs finish on the first visit. If parts must be ordered, we will schedule a return trip when they arrive.';

/** Half of diagnostic fee credited toward repair (whole dollars, rounded up). */
export function getDiagnosticRepairCreditAmount(diagnosticPrice = OPENING_SPECIAL_PRICE) {
  return Math.ceil(Number(diagnosticPrice) / 2);
}

/** Shared promise copy for homepage, city pages, and /about. */
export function getDiagnosticFeePromiseParagraph(diagnosticPrice = OPENING_SPECIAL_PRICE) {
  const credit = getDiagnosticRepairCreditAmount(diagnosticPrice);
  return (
    'Same-day diagnostics when available, upfront pricing, and a 90-day warranty on repairs we complete. '
    + `Your diagnostic fee is never wasted: if you approve the repair, half of it ($${credit} of the $${diagnosticPrice}) goes toward the repair. `
    + 'If a repair attempt is unsuccessful, you won\'t be charged labor for that repair.'
  );
}
