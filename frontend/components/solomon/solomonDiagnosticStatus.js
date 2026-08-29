/**
 * Solomon diagnostic lifecycle — semantic status tokens.
 * Colors communicate lifecycle state, not decoration.
 *
 * Lifecycle: diagnose (cyan) → repair pending (orange) → successful (green) → memory (purple)
 */

export const SOLOMON_DIAGNOSTIC_STATUS = {
  diagnostic_in_progress: 'diagnostic_in_progress',
  repair_outcome_pending: 'repair_outcome_pending',
  repair_successful: 'repair_successful',
  repair_memory: 'repair_memory',
  abandoned: 'abandoned',
  pending_sync: 'pending_sync',
};

const POOL_VISIBILITIES = new Set(['training_corpus', 'public']);

const STATUS_TOKENS = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: {
    label: 'In progress',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25',
    topAccentClass: 'border-t-cyan-400',
    cardBorderClass: 'border-white/10 hover:border-cyan-500/30',
    cardGlowClass: 'shadow-[0_-6px_20px_rgba(34,211,238,0.07)]',
    labelTextClass: 'text-cyan-400/90',
    progressActiveClass: 'bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.45)]',
    surfaceHeroClass:
      'border-cyan-400/35 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(34,211,238,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]',
    surfaceDefaultClass:
      'border-cyan-500/25 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
    hoverBorderClass: 'hover:border-cyan-400/40',
  },
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: {
    label: 'Outcome pending',
    badgeClass: 'bg-orange-500/15 text-orange-300 border border-orange-500/25',
    topAccentClass: 'border-t-orange-400',
    cardBorderClass: 'border-white/10 hover:border-orange-500/30',
    cardGlowClass: 'shadow-[0_-6px_20px_rgba(249,115,22,0.08)]',
    labelTextClass: 'text-orange-400/90',
    progressActiveClass: 'bg-orange-400 shadow-[0_0_3px_rgba(251,146,60,0.45)]',
    surfaceHeroClass:
      'border-orange-400/35 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(251,146,60,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]',
    surfaceDefaultClass:
      'border-orange-500/25 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
    hoverBorderClass: 'hover:border-orange-400/40',
  },
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: {
    label: 'Completed',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
    topAccentClass: 'border-t-emerald-400',
    cardBorderClass: 'border-white/10 hover:border-emerald-500/30',
    cardGlowClass: 'shadow-[0_-6px_20px_rgba(52,211,153,0.08)]',
    labelTextClass: 'text-emerald-400/90',
    progressActiveClass: 'bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.45)]',
    surfaceHeroClass:
      'border-emerald-400/35 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(52,211,153,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]',
    surfaceDefaultClass:
      'border-emerald-500/25 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
    hoverBorderClass: 'hover:border-emerald-400/40',
  },
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: {
    label: 'In repair memory',
    badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/25',
    topAccentClass: 'border-t-purple-400',
    cardBorderClass: 'border-white/10 hover:border-purple-500/30',
    cardGlowClass: 'shadow-[0_-6px_20px_rgba(168,85,247,0.09)]',
    labelTextClass: 'text-purple-400/90',
    progressActiveClass: 'bg-purple-400 shadow-[0_0_3px_rgba(192,132,252,0.45)]',
    surfaceHeroClass:
      'border-purple-400/35 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(192,132,252,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]',
    surfaceDefaultClass:
      'border-purple-500/25 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
    hoverBorderClass: 'hover:border-purple-400/40',
  },
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: {
    label: 'Abandoned',
    badgeClass: 'bg-white/5 text-gray-400 border border-white/10',
    topAccentClass: 'border-t-white/20',
    cardBorderClass: 'border-white/10 hover:border-white/20',
    cardGlowClass: '',
    labelTextClass: 'text-gray-400/90',
    progressActiveClass: 'bg-white/40',
    surfaceHeroClass:
      'border-white/15 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)]',
    surfaceDefaultClass:
      'border-white/15 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
    hoverBorderClass: 'hover:border-white/25',
  },
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: {
    label: 'Pending sync',
    badgeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
    topAccentClass: 'border-t-sky-400',
    cardBorderClass: 'border-white/10 hover:border-sky-500/30',
    cardGlowClass: 'shadow-[0_-6px_20px_rgba(56,189,248,0.07)]',
    labelTextClass: 'text-sky-400/90',
    progressActiveClass: 'bg-sky-400 shadow-[0_0_3px_rgba(56,189,248,0.45)]',
    surfaceHeroClass:
      'border-sky-400/35 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(56,189,248,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]',
    surfaceDefaultClass:
      'border-sky-500/25 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
    hoverBorderClass: 'hover:border-sky-400/40',
  },
};

function isDiagnosticAwaitingOutcome(diagnostic) {
  const status = String(diagnostic?.status || 'in_progress').toLowerCase();
  return status === 'completed' && !diagnostic?.outcome_id;
}

export function isRepairMemoryOutcome(outcomeSummary) {
  if (!outcomeSummary?.repair_successful) return false;

  const confidence = String(outcomeSummary.outcome_confidence || '').toLowerCase();
  if (confidence === 'incorrect' || confidence === 'unconfirmed') return false;
  if (confidence && confidence !== 'confirmed') return false;

  const context = String(outcomeSummary.context || 'tech').toLowerCase();
  if (context === 'diy') {
    return outcomeSummary.moderation_status === 'approved'
      && POOL_VISIBILITIES.has(outcomeSummary.visibility);
  }
  return outcomeSummary.moderation_status !== 'rejected';
}

function outcomeSummaryFromRecord(record) {
  if (!record) return null;
  return {
    repair_successful: Boolean(record.repair_successful),
    outcome_confidence: record.outcome_confidence,
    moderation_status: record.moderation_status,
    visibility: record.visibility,
    context: record.context,
  };
}

/** Map a repair outcome / pool record to the shared lifecycle tokens. */
export function resolveSolomonOutcomeStatus(record) {
  if (!record) {
    return resolveSolomonDiagnosticStatus(null);
  }

  const summary = outcomeSummaryFromRecord(record);
  let lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_successful;

  if (isRepairMemoryOutcome(summary)) {
    lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
  } else if (!record.repair_successful) {
    lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending;
  }

  const lifecycleTokens = STATUS_TOKENS[lifecycleKey];
  return {
    key: lifecycleKey,
    lifecycleKey,
    label: lifecycleTokens.label,
    isPendingSync: false,
    ...lifecycleTokens,
    badgeClass: lifecycleTokens.badgeClass,
    labelTextClass: lifecycleTokens.labelTextClass,
  };
}

/** Repair memory search hits — pool results default to repair_memory when fields are sparse. */
export function resolveSolomonPoolSearchResultStatus(item) {
  if (!item) {
    return resolveSolomonOutcomeStatus({ repair_successful: true, moderation_status: 'approved', visibility: 'training_corpus', context: 'tech' });
  }
  return resolveSolomonOutcomeStatus({
    repair_successful: item.repair_successful !== false,
    outcome_confidence: item.outcome_confidence,
    moderation_status: item.moderation_status || 'approved',
    visibility: item.visibility || 'training_corpus',
    context: item.context || 'tech',
  });
}

/** Derive lifecycle status from diagnostic + optional linked outcome summary. */
export function resolveSolomonDiagnosticStatus(diagnostic) {
  if (!diagnostic) {
    return {
      key: SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress,
      lifecycleKey: SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress,
      ...STATUS_TOKENS[SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress],
      isPendingSync: false,
    };
  }

  const status = String(diagnostic.status || 'in_progress').toLowerCase();
  const outcomeSummary = diagnostic.outcome_summary || null;
  let lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress;

  if (status === 'abandoned') {
    lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.abandoned;
  } else if (diagnostic.outcome_id) {
    if (outcomeSummary) {
      if (isRepairMemoryOutcome(outcomeSummary)) {
        lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
      } else if (outcomeSummary.repair_successful) {
        lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_successful;
      } else {
        lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending;
      }
    } else {
      lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_successful;
    }
  } else if (isDiagnosticAwaitingOutcome(diagnostic)) {
    lifecycleKey = SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending;
  }

  const lifecycleTokens = STATUS_TOKENS[lifecycleKey];
  const isPendingSync = Boolean(diagnostic.pendingSync);
  const displayKey = isPendingSync
    ? SOLOMON_DIAGNOSTIC_STATUS.pending_sync
    : lifecycleKey;
  const displayTokens = isPendingSync
    ? STATUS_TOKENS[SOLOMON_DIAGNOSTIC_STATUS.pending_sync]
    : lifecycleTokens;

  return {
    key: displayKey,
    lifecycleKey,
    label: displayTokens.label,
    isPendingSync,
    ...lifecycleTokens,
    badgeClass: displayTokens.badgeClass,
    labelTextClass: isPendingSync
      ? STATUS_TOKENS[SOLOMON_DIAGNOSTIC_STATUS.pending_sync].labelTextClass
      : lifecycleTokens.labelTextClass,
  };
}

/** List/history card shell — dark surface + thin top accent + subtle glow. */
export function solomonDiagnosticListCardClass(status) {
  return [
    'rounded-xl border border-t-2 bg-[#0D1525] transition-colors overflow-hidden',
    status.topAccentClass,
    status.cardBorderClass,
    status.cardGlowClass,
  ].filter(Boolean).join(' ');
}

/** Detail panel — dark surface with lifecycle accent, no layout change. */
export function solomonDiagnosticDetailPanelClass(status) {
  return [
    'rounded-xl border border-t-2 bg-[#0D1525]',
    status.topAccentClass,
    status.cardBorderClass,
    status.cardGlowClass,
  ].filter(Boolean).join(' ');
}

export function SolomonDiagnosticStatusBadge({ status, className = '' }) {
  const resolved = typeof status === 'object' && status?.badgeClass
    ? status
    : resolveSolomonDiagnosticStatus(status);
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${resolved.badgeClass} ${className}`}
    >
      {resolved.label}
    </span>
  );
}
