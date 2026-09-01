import Link from 'next/link';
import { FaCheckCircle, FaClock, FaMinus, FaPlus } from 'react-icons/fa';
import { SOLOMON_DIAGNOSTIC_STATUS } from './solomonDiagnosticStatus';
import SolomonCategoryIcon from './categoryIcons';

export const SOLOMON_PAGE_SHELL_CLASS = '!bg-[var(--solomon-bg-canvas)] relative min-w-0 overflow-x-hidden !px-4 max-w-lg';

export const SOLOMON_PAGE_TITLE_CLASS =
  'text-[1.75rem] font-bold tracking-tight text-[var(--solomon-text-primary)] leading-tight';

export const SOLOMON_PAGE_DESCRIPTION_CLASS =
  'text-sm text-[var(--solomon-text-secondary)] mt-1.5 leading-relaxed';

export const SOLOMON_FILTER_ACTIVE_CLASS =
  'bg-[var(--solomon-primary-from)]/10 solomon-backdrop-blur border-[color:var(--solomon-primary-border)] text-[var(--solomon-text-primary)] shadow-[var(--solomon-primary-shadow)]';

export const SOLOMON_FILTER_IDLE_CLASS =
  'bg-[var(--solomon-surface-glass)] solomon-backdrop-blur border-[color:var(--solomon-border-subtle)] text-[var(--solomon-text-muted)] hover:border-[color:var(--solomon-border-subtle)] hover:text-[var(--solomon-text-secondary)]';

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
    'relative block rounded-xl border border-t-2 border-white/15 overflow-hidden solomon-backdrop-blur transition-colors duration-200',
    'bg-[var(--solomon-surface-glass)] shadow-[var(--solomon-shadow-inset-highlight),var(--solomon-shadow-card)]',
    'hover:border-white/22 hover:bg-[var(--solomon-surface-glass-hover)]',
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
  const showDash = lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.abandoned;
  const glow = BADGE_GLOW_BY_LIFECYCLE[lifecycleKey] || '';

  return (
    <span
      role="status"
      aria-label={status.label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] backdrop-blur-sm bg-[var(--solomon-surface-elevated)] ${status.badgeClass} ${glow}`}
    >
      {showSpinner ? (
        <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" aria-hidden />
      ) : null}
      {showCheck ? <FaCheckCircle size={10} aria-hidden /> : null}
      {showDash ? <FaMinus size={10} aria-hidden /> : null}
      <span>{status.label}</span>
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

/**
 * Bottom-right badge = workflow / session state.
 * Hide when the top headline already carries the same conclusion (e.g. verified memory).
 */
export function shouldShowListCardWorkflowBadge(status) {
  const lifecycleKey = status?.lifecycleKey || status?.key;
  if (lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory) {
    return false;
  }
  return true;
}

/** Category icon tint — matches lifecycle semantic color. */
const CATEGORY_ICON_SHELL_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: 'bg-cyan-500/10 text-cyan-400',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'bg-orange-500/10 text-orange-400',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'bg-emerald-500/10 text-emerald-400',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'bg-purple-500/10 text-purple-400',
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: 'bg-white/5 text-gray-400',
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: 'bg-sky-500/10 text-sky-400',
};

/**
 * Top-right card headline — separates diagnostic likelihood from repair confirmation.
 * @param {object} props
 * @param {object} props.status Resolved lifecycle status
 * @param {object} [props.lead] Leading hypothesis from useSolomonDiagnosticLead
 * @param {string} [props.categoryLabel] Override category label (outcomes / memory)
 * @param {string} [props.categoryId] Evidence category id for icon (diagnostics)
 */
export function SolomonListLifecycleHeadline({
  status,
  lead = null,
  categoryLabel = null,
  categoryId = null,
  className = '',
}) {
  const lifecycleKey = status?.lifecycleKey || status?.key;
  const systemLabel = categoryLabel || lead?.categoryLabel;
  const systemId = categoryId || lead?.categoryId;
  const iconShell = CATEGORY_ICON_SHELL_BY_LIFECYCLE[lifecycleKey]
    || CATEGORY_ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress];

  let primaryLine = null;
  let primaryClass = 'text-white/90';
  let showLikelihoodMeter = false;
  let secondaryLine = null;

  switch (lifecycleKey) {
    case SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress:
      if (lead) {
        primaryLine = `${lead.percent}% ${lead.strengthWord}`;
        primaryClass = 'text-cyan-400';
        showLikelihoodMeter = true;
      }
      break;
    case SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending:
      primaryLine = 'OUTCOME PENDING';
      primaryClass = 'text-orange-400';
      if (lead) {
        secondaryLine = `Was ${lead.percent}% ${lead.strengthWord}`;
      }
      break;
    case SOLOMON_DIAGNOSTIC_STATUS.repair_successful:
      primaryLine = '✓ REPAIR CONFIRMED';
      primaryClass = 'text-emerald-400';
      break;
    case SOLOMON_DIAGNOSTIC_STATUS.repair_memory:
      primaryLine = '✓ VERIFIED • IN MEMORY';
      primaryClass = 'text-purple-300';
      break;
    case SOLOMON_DIAGNOSTIC_STATUS.abandoned:
      primaryLine = 'ABANDONED';
      primaryClass = 'text-gray-400';
      break;
    case SOLOMON_DIAGNOSTIC_STATUS.pending_sync:
      primaryLine = 'PENDING SYNC';
      primaryClass = 'text-sky-400';
      break;
    default:
      break;
  }

  if (!systemLabel && !primaryLine) return null;

  const meterColorClass = lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress
    ? 'bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.5)]'
    : 'bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.5)]';

  return (
    <div className={`shrink-0 min-w-0 max-w-[52%] text-right ${className}`}>
      {systemLabel ? (
        <div className="flex items-center justify-end gap-1.5">
          {systemId ? (
            <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md ${iconShell}`}>
              <SolomonCategoryIcon
                categoryId={systemId}
                categoryLabel={systemLabel}
                size={11}
              />
            </span>
          ) : null}
          <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.07em] leading-none text-white/85">
            {systemLabel}
          </span>
        </div>
      ) : null}
      {primaryLine ? (
        <p className={`mt-0.5 text-[11px] font-bold tracking-[0.06em] tabular-nums leading-none ${primaryClass}`}>
          {primaryLine}
        </p>
      ) : null}
      {showLikelihoodMeter && lead ? (
        <div className="mt-1 ml-auto h-1 w-full max-w-[108px] overflow-hidden rounded-full bg-white/55 ring-1 ring-inset ring-white/15">
          <div
            className={`h-full ${meterColorClass}`}
            style={{ width: `${Math.min(100, lead.percent)}%` }}
          />
        </div>
      ) : null}
      {secondaryLine ? (
        <p className="mt-1 text-[10px] tabular-nums text-gray-500">{secondaryLine}</p>
      ) : null}
    </div>
  );
}

/** @deprecated Use SolomonListLifecycleHeadline */
export function SolomonListLeadMeter({ lead, status, className }) {
  return (
    <SolomonListLifecycleHeadline
      status={status || { lifecycleKey: SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress }}
      lead={lead}
      className={className}
    />
  );
}

/** Bottom row — timestamp left, workflow badge right (when distinct from top headline). */
export function SolomonListCardFooter({ when, status, showClock = false }) {
  const showWorkflowBadge = shouldShowListCardWorkflowBadge(status);
  if (!when && !showWorkflowBadge) return null;

  return (
    <div className="flex items-end justify-between gap-2 mt-2">
      {when ? (
        <p className="flex items-center gap-1 text-[10px] text-gray-500 min-w-0">
          {showClock ? <FaClock size={9} className="shrink-0 opacity-75" aria-hidden /> : null}
          {when}
        </p>
      ) : (
        <span />
      )}
      {showWorkflowBadge ? <SolomonLifecycleStatusBadge status={status} /> : null}
    </div>
  );
}

export function SolomonCyanAddButton({ href, ariaLabel }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] border border-[color:var(--solomon-primary-border)] shadow-[var(--solomon-primary-shadow)] transition-colors hover:opacity-95"
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
  'w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2.5 text-sm text-white placeholder:text-[color:var(--solomon-text-placeholder)] solomon-backdrop-blur focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-[color:var(--solomon-focus-ring)] transition-colors [color-scheme:dark] [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_var(--solomon-surface)] [&:-webkit-autofill]:[-webkit-text-fill-color:#fff]';

export const SOLOMON_GLASS_SELECT_OPTION_CLASS = 'bg-[var(--solomon-surface)] text-white';

export const SOLOMON_GLASS_PANEL_CLASS =
  'rounded-xl border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-glass)] solomon-backdrop-blur p-4 shadow-[var(--solomon-shadow-inset-highlight),var(--solomon-shadow-card)]';

export const SOLOMON_LIST_CARD_PADDING_CLASS = 'p-3.5';
export const SOLOMON_LIST_STACK_CLASS = 'space-y-2.5';
export const SOLOMON_LIST_ICON_BOX_CLASS = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border';

export const SOLOMON_SEARCH_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] border border-[color:var(--solomon-primary-border)] px-4 py-3 text-sm font-medium text-white shadow-[var(--solomon-primary-shadow)] transition-colors hover:opacity-95 disabled:opacity-50';

export const SOLOMON_REFERENCE_ICON_SHELL_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--solomon-status-reference)]/15 text-[color:var(--solomon-status-reference)] border border-[color:var(--solomon-status-reference)]/25';

export const SOLOMON_REFERENCE_EYEBROW_CLASS =
  'text-[10px] uppercase tracking-[0.14em] text-[color:var(--solomon-status-reference)]/90';

export const SOLOMON_REFERENCE_CODE_TEXT_CLASS =
  'text-base font-semibold text-[color:var(--solomon-status-reference)]';

export const SOLOMON_REFERENCE_CHIP_ACTIVE_CLASS =
  'border-[color:var(--solomon-status-reference)]/40 bg-[color:var(--solomon-status-reference)]/10 text-[color:var(--solomon-status-reference)]';

export const SOLOMON_REFERENCE_CHIP_IDLE_CLASS =
  'border-[color:var(--solomon-border-subtle)] text-[var(--solomon-text-secondary)] hover:border-[color:var(--solomon-status-reference)]/30';

export const SOLOMON_CODES_SEARCH_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[color:var(--solomon-status-reference)] to-[color:var(--solomon-status-reference)]/80 border border-[color:var(--solomon-status-reference)]/30 px-4 py-3 text-sm font-medium text-white shadow-[var(--solomon-shadow-card)] transition-colors hover:opacity-95 disabled:opacity-50';

export const SOLOMON_CODES_RESULT_LINK_CLASS =
  'block rounded-xl border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-glass)] solomon-backdrop-blur p-3.5 shadow-[var(--solomon-shadow-inset-highlight),var(--solomon-shadow-card)] hover:border-[color:var(--solomon-status-reference)]/25 hover:bg-[var(--solomon-surface-glass-hover)] transition-colors';

export const SOLOMON_FORM_LABEL_CLASS =
  'block text-xs uppercase tracking-wide text-[var(--solomon-text-muted)] mb-1';

export const SOLOMON_FORM_SECTION_TITLE_CLASS =
  'text-[10px] uppercase tracking-[0.2em] text-[var(--solomon-primary-from)]/90';

export const SOLOMON_FORM_PANEL_CLASS =
  'rounded-xl border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] p-4 space-y-3';

export const SOLOMON_FORM_SUBMIT_CLASS =
  'w-full h-11 rounded-xl bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] text-sm font-semibold uppercase tracking-wide text-white shadow-[var(--solomon-primary-shadow)] disabled:opacity-60';
