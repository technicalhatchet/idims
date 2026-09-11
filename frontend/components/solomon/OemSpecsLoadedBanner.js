'use client';

/**
 * Quiet confirmation that platform-matched OEM measurement specs resolved.
 * Field guided diagnostics — no manual id or test counts.
 */
export default function OemSpecsLoadedBanner({
  platformLabel,
  equipmentMake,
  equipmentModel,
  compact = false,
  className = '',
}) {
  if (!platformLabel) return null;

  const equipmentLabel =
    equipmentMake && equipmentModel ? `${equipmentMake} ${equipmentModel}` : null;

  return (
    <div
      className={`rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      } ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">
        OEM specs loaded
      </p>
      <p
        className={`font-medium text-[var(--solomon-text-primary)] ${
          compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'
        }`}
      >
        {platformLabel}
      </p>
      {equipmentLabel ? (
        <p
          className={`text-[var(--solomon-text-secondary)] ${
            compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs'
          }`}
        >
          {equipmentLabel}
        </p>
      ) : null}
    </div>
  );
}
