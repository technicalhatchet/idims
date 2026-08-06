/** Shared surface + type scale for mobile WO Details (minimal / premium). */

export const WO_DETAILS_SURFACE_STYLE = {
  background: '#0E1825',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  boxShadow: 'inset 0 1px rgba(255, 255, 255, 0.03), 0 8px 24px rgba(0, 0, 0, 0.25)',
};

export const WO_DETAILS_SURFACE_CLASS = 'rounded-[15px] overflow-hidden';

export const WO_DETAILS_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-[0.12em] text-white/[0.45]';

export const WO_DETAILS_PRIMARY_CLASS = 'text-lg font-semibold text-white/[0.95] leading-snug';

export const WO_DETAILS_SECONDARY_CLASS = 'text-[15px] font-normal text-white/[0.55] leading-snug';

export const WO_DETAILS_TERTIARY_CLASS = 'text-[13px] font-normal text-white/40 leading-snug';

/** Subtle icon-only action (call, navigate) on details cards. */
export const WO_DETAILS_ICON_BTN_CLASS =
  'flex items-center justify-center w-9 h-9 rounded-[10px] shrink-0 transition-[transform,box-shadow] active:scale-95 hover:shadow-[0_0_14px_rgba(34,211,238,0.12)]';

export const WO_DETAILS_ICON_BTN_STYLE = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: 'none',
};
