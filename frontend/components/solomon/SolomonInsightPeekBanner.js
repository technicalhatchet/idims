'use client';

/**
 * Compact tap-to-scroll banner — surfaces insight updates below the wizard on mobile.
 */
export default function SolomonInsightPeekBanner({
  label,
  onView,
  onDismiss,
  variant = 'mobile',
  tone = 'cyan',
}) {
  const isMobile = variant === 'mobile';

  const toneClasses =
    tone === 'violet'
      ? isMobile
        ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
        : 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950/40'
      : isMobile
        ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100'
        : 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950/40';

  const actionClass =
    tone === 'violet'
      ? isMobile
        ? 'text-violet-200 font-medium'
        : 'text-violet-700 dark:text-violet-300 font-medium'
      : isMobile
        ? 'text-cyan-200 font-medium'
        : 'text-cyan-700 dark:text-cyan-300 font-medium';

  return (
    <div
      className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-3 text-xs shadow-lg shadow-black/20 ${toneClasses}`}
      role="status"
    >
      <button type="button" onClick={onView} className={`${actionClass} text-left hover:underline`}>
        {label}
      </button>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className={`shrink-0 opacity-60 hover:opacity-100 ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}
          aria-label="Dismiss"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
