import Link from 'next/link';
import { FaCheckCircle, FaPlus } from 'react-icons/fa';
import { SOLOMON_DIAGNOSTIC_STATUS } from './solomonDiagnosticStatus';

export const SOLOMON_PAGE_SHELL_CLASS = '!bg-[#070b14] relative overflow-hidden !px-4 max-w-lg';

export const SOLOMON_FILTER_ACTIVE_CLASS =
  'bg-cyan-500/10 backdrop-blur-md border-cyan-400/45 text-cyan-50 shadow-[0_0_12px_rgba(34,211,238,0.12)]';

export const SOLOMON_FILTER_IDLE_CLASS =
  'bg-[#060a12]/78 backdrop-blur-md border-white/15 text-white/42 hover:border-white/22 hover:text-white/58';

/** Home-menu tile icon shells — semantic lifecycle colors. */
export const SOLOMON_ICON_SHELL_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.08)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'bg-orange-500/12 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(251,146,60,0.08)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.08)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'bg-purple-500/12 text-purple-400 border-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.1)]',
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: 'bg-white/5 text-gray-400 border-white/12',
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: 'bg-sky-500/12 text-sky-400 border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.08)]',
};

/** @deprecated Use SOLOMON_ICON_SHELL_BY_LIFECYCLE */
export const SOLOMON_ICON_BORDER_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: 'border-cyan-500/20',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'border-orange-500/20',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'border-emerald-500/20',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'border-purple-500/25',
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: 'border-white/12',
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: 'border-sky-500/20',
};

const BADGE_GLOW_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: 'shadow-[0_0_10px_rgba(34,211,238,0.18)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'shadow-[0_0_10px_rgba(251,146,60,0.18)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'shadow-[0_0_10px_rgba(52,211,153,0.16)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'shadow-[0_0_12px_rgba(168,85,247,0.22)]',
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: '',
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: 'shadow-[0_0_10px_rgba(56,189,248,0.16)]',
};

/** List card shell — home-menu glass + lifecycle accent from status resolver. */
export function solomonLifecycleListSurfaceClass(status) {
  const isMemory = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
  return [
    'relative block rounded-xl border border-t-2 border-white/15 overflow-hidden backdrop-blur-md transition-colors duration-200',
    'bg-[#060a12]/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_22px_rgba(0,0,0,0.32)]',
    'hover:border-white/22 hover:bg-[#060a12]/86',
    status.topAccentClass,
    status.cardGlowClass,
    isMemory ? 'ring-1 ring-purple-400/12' : '',
  ].filter(Boolean).join(' ');
}

export function SolomonLifecycleStatusBadge({ status }) {
  const lifecycleKey = status.lifecycleKey || status.key;
  const showSpinner = lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress
    || lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending
    || status.key === SOLOMON_DIAGNOSTIC_STATUS.pending_sync;
  const showCheck = lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_successful
    || lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
  const glow = BADGE_GLOW_BY_LIFECYCLE[lifecycleKey] || '';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] backdrop-blur-sm bg-[#060a12]/80 ${status.badgeClass} ${glow}`}
    >
      {showSpinner ? (
        <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" aria-hidden />
      ) : null}
      {showCheck ? <FaCheckCircle size={10} aria-hidden /> : null}
      {status.label}
    </span>
  );
}

export function isSolomonCompletedLifecycle(status) {
  return status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_successful
    || status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
}

export function isSolomonRepairMemoryLifecycle(status) {
  return status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
}

export function SolomonCyanAddButton({ href, ariaLabel }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0089B9] to-[#006a94] border border-cyan-400/35 shadow-[0_4px_18px_rgba(0,137,185,0.4)] transition-colors hover:from-[#0099cc] hover:to-[#007aa8]"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white">
        <FaPlus size={11} aria-hidden />
      </span>
    </Link>
  );
}

export function SolomonOrangeAddButton({ href, ariaLabel, label = 'Add' }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-400/40 bg-gradient-to-br from-orange-500/90 to-orange-600/85 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_0_16px_rgba(251,146,60,0.24)] backdrop-blur-sm transition-colors hover:from-orange-400 hover:to-orange-500"
    >
      <FaPlus size={10} aria-hidden />
      {label}
    </Link>
  );
}

export const SOLOMON_GLASS_INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-[#060a12]/78 px-3 py-2.5 text-sm text-white placeholder:text-white/35 backdrop-blur-md focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition-colors';

export const SOLOMON_GLASS_PANEL_CLASS =
  'rounded-xl border border-white/15 bg-[#060a12]/78 backdrop-blur-md p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_22px_rgba(0,0,0,0.32)]';

export const SOLOMON_LIST_CARD_PADDING_CLASS = 'p-3.5';
export const SOLOMON_LIST_STACK_CLASS = 'space-y-2.5';
export const SOLOMON_LIST_ICON_BOX_CLASS = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border';

export const SOLOMON_SEARCH_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#0089B9] to-[#006a94] border border-cyan-400/30 px-4 py-3 text-sm font-medium text-white shadow-[0_4px_18px_rgba(0,137,185,0.38)] transition-colors hover:from-[#0099cc] hover:to-[#007aa8] disabled:opacity-50';
