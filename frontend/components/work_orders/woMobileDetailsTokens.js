/** Shared surface + type scale for mobile WO Details (minimal / premium). */

export const WO_DETAILS_SURFACE_STYLE = {
  background: '#0E1825',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  boxShadow: 'inset 0 1px rgba(255, 255, 255, 0.03), 0 8px 24px rgba(0, 0, 0, 0.25)',
};

export const WO_DETAILS_SURFACE_CLASS = 'rounded-[15px] overflow-visible';

export const WO_DETAILS_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-[0.12em] text-white/[0.45]';

export const WO_DETAILS_PRIMARY_CLASS = 'text-lg font-semibold text-white/[0.95] leading-snug';

export const WO_DETAILS_SECONDARY_CLASS = 'text-[15px] font-normal text-white/[0.55] leading-snug';

export const WO_DETAILS_TERTIARY_CLASS = 'text-[13px] font-normal text-white/40 leading-snug';

/** Horizontal inset for Details tab cards/accordions (~¼ of prior px-5). */
export const WO_DETAILS_PAD_X = 'px-1.5';

/** Service address line — lighter than client/appliance primary. */
export const WO_DETAILS_LOCATION_CLASS =
  'text-[14px] font-normal text-white/[0.58] leading-snug';

/** Bare icon action (call, navigate) — no tile background. */
export const WO_DETAILS_ICON_BTN_CLASS =
  'flex items-center justify-center w-8 h-8 shrink-0 p-0 border-0 bg-transparent transition-opacity active:opacity-70 hover:opacity-100';

export const WO_DETAILS_ICON_BTN_STYLE = {
  background: 'transparent',
  border: 'none',
};
