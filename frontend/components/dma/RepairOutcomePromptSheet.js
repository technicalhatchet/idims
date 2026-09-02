export default function RepairOutcomePromptSheet({
  open,
  onClose,
  onAddOutcome,
  onAddExternalCause,
  variant = 'mobile',
}) {
  if (!open) return null;

  const shellClass =
    variant === 'mobile'
      ? 'fixed inset-0 z-[1210] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';

  const panelClass =
    variant === 'mobile'
      ? 'w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-cyan-500/25 bg-[#0D1525] p-5 pb-6 shadow-[0_0_32px_rgba(34,211,238,0.12)]'
      : 'w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl';

  return (
    <div className={shellClass} onClick={onClose}>
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90 mb-1">
          Repair Memory
        </p>
        <h3 className={`text-lg font-semibold mb-2 ${variant === 'mobile' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          Log this repair?
        </h3>
        <p className={`text-sm mb-5 ${variant === 'mobile' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
          This job is fully paid and marked complete. Add a Repair Outcome note so future you can find this fix in Repair Memory.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onAddOutcome}
            className="h-11 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-sm font-semibold text-white"
          >
            Add Repair Outcome
          </button>
          {onAddExternalCause ? (
            <button
              type="button"
              onClick={onAddExternalCause}
              className={`h-11 rounded-xl border text-sm font-medium ${
                variant === 'mobile'
                  ? 'border-amber-500/35 text-amber-200 hover:bg-amber-500/10'
                  : 'border-amber-300 text-amber-800 dark:border-amber-500/40 dark:text-amber-200'
              }`}
            >
              Not appliance fault (vent, plumbing, etc.)
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={`h-11 rounded-xl border text-sm font-medium ${
              variant === 'mobile'
                ? 'border-white/15 text-gray-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
