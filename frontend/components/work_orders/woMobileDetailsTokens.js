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

/** 16px body line (client name, appliance type, etc.) — medium weight between normal and semibold. */
export const WO_DETAILS_BODY_16_CLASS = 'text-base font-medium text-white/[0.95] leading-snug';

/** 14px secondary line (tenant on client card). */
export const WO_DETAILS_TENANT_CLASS = 'text-sm font-normal text-white/[0.55] leading-snug';

export const WO_DETAILS_TERTIARY_CLASS = 'text-[13px] font-normal text-white/40 leading-snug';

/** Inner horizontal padding inside Details summary cards / accordions. */
export const WO_DETAILS_PAD_X = 'px-5';

/** Vertical padding inside summary cards. */
export const WO_DETAILS_PAD_Y = 'py-3';

export const WO_DETAILS_PAD_Y_COMPACT = 'py-2.5';

/** Service address — 16px regular (not medium). */
export const WO_DETAILS_LOCATION_CLASS =
  'text-base font-normal text-white/[0.95] leading-snug';

/** Bare icon action (call, navigate) — no tile background. */
export const WO_DETAILS_ICON_BTN_CLASS =
  'flex items-center justify-center w-8 h-8 shrink-0 p-0 border-0 bg-transparent transition-opacity active:opacity-70 hover:opacity-100';

export const WO_DETAILS_ICON_BTN_STYLE = {
  background: 'transparent',
  border: 'none',
};
