import { EXTERNAL_CAUSE_PRESETS } from '../../constants/externalCauseOutcomes';

/**
 * Quick-pick row for closing a visit when the appliance is not at fault.
 * Still records a repair outcome for repair memory.
 */
export default function ExternalCauseOutcomePick({
  onSelectPreset,
  variant = 'default',
  className = '',
}) {
  const isDark = variant === 'dark' || variant === 'solomon';
  const shellClass = isDark
    ? 'rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-2'
    : 'rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-3 space-y-2';

  const titleClass = isDark
    ? 'text-[10px] uppercase tracking-[0.2em] text-amber-300/90'
    : 'text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300';

  const hintClass = isDark ? 'text-xs text-gray-400' : 'text-xs text-amber-900/70 dark:text-gray-400';

  const chipClass = isDark
    ? 'rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-left text-sm text-white hover:border-amber-500/40 transition-colors'
    : 'rounded-lg border border-amber-200/80 bg-white dark:bg-gray-900 dark:border-white/10 px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-200 hover:border-amber-400 transition-colors';

  const descClass = isDark ? 'text-[10px] text-gray-500 mt-0.5' : 'text-[10px] text-gray-500 dark:text-gray-400 mt-0.5';

  return (
    <div className={`${shellClass} ${className}`.trim()}>
      <div>
        <p className={titleClass}>Not appliance fault</p>
        <p className={hintClass}>
          Issue resolved without repairing the unit — still logs to Repair Memory with callback option below.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {EXTERNAL_CAUSE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset.id)}
            className={chipClass}
          >
            <span className="font-medium">{preset.label}</span>
            <p className={descClass}>{preset.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
