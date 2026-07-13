'use client';

export default function ExplainRouteBanner({ diff, variant = 'mobile', onDismiss }) {
  if (!diff || (!diff.added.length && !diff.removed.length)) return null;

  const isMobile = variant === 'mobile';

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm space-y-2 ${
        isMobile
          ? 'border-cyan-500/30 bg-cyan-500/[0.06] text-gray-200'
          : 'border-cyan-200 bg-cyan-50 text-gray-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`font-semibold ${isMobile ? 'text-cyan-300' : 'text-cyan-800 dark:text-cyan-300'}`}>
          Diagnostic path updated
        </p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`text-xs shrink-0 ${isMobile ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500'}`}
          >
            Dismiss
          </button>
        )}
      </div>

      {diff.triggers.length > 0 && (
        <div>
          <p className={`text-xs font-medium mb-1 ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
            Based on:
          </p>
          <ul className="text-xs space-y-0.5">
            {diff.triggers.map((t) => (
              <li key={t}>✓ {t}</li>
            ))}
          </ul>
        </div>
      )}

      {diff.added.length > 0 && (
        <div>
          <p className={`text-xs font-medium mb-1 ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
            Added:
          </p>
          <ul className="text-xs space-y-0.5">
            {diff.added.map((s) => (
              <li key={s.stepKey}>• {s.title}</li>
            ))}
          </ul>
        </div>
      )}

      {diff.removed.length > 0 && (
        <div>
          <p className={`text-xs font-medium mb-1 ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
            Skipped for now:
          </p>
          <ul className="text-xs space-y-0.5 opacity-80">
            {diff.removed.map((s) => (
              <li key={s.stepKey}>• {s.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
