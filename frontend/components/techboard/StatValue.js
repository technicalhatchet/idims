/** Shared stat-card value states for the Techboard dashboard. */

export function StatValueSkeleton() {
  return (
    <div
      className="h-8 w-12 rounded-md bg-white/10 animate-pulse"
      aria-hidden
      data-testid="stat-value-skeleton"
    />
  );
}

export function StatValueUnavailable({ onRetry }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xl font-bold text-white tabular-nums">—</span>
      {onRetry ? (
        <button
          type="button"
          className="text-[10px] font-medium text-cyan-400/90 underline text-left w-fit"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
