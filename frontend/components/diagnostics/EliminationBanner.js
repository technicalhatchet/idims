'use client';

export default function EliminationBanner({ result, variant = 'mobile' }) {
  const hasContent =
    result &&
    (result.confirmed?.length || result.suspected?.length || result.eliminated?.length);

  if (!hasContent) return null;

  const isMobile = variant === 'mobile';

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] space-y-2 ${
        isMobile
          ? 'border-violet-500/25 bg-violet-500/[0.06] text-violet-100'
          : 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100'
      }`}
    >
      <p className="font-semibold uppercase tracking-wide opacity-90">Diagnostic reasoning</p>

      {result.confirmed?.length > 0 && (
        <div>
          <p className="opacity-75 mb-0.5">Confirmed</p>
          <ul className="space-y-0.5">
            {result.confirmed.map((item) => (
              <li key={item.id}>✓ {item.label}</li>
            ))}
          </ul>
        </div>
      )}

      {result.suspected?.length > 0 && (
        <div>
          <p className="opacity-75 mb-0.5">Likely causes</p>
          <ul className="space-y-0.5">
            {result.suspected.map((item) => (
              <li key={item.id}>→ {item.label}</li>
            ))}
          </ul>
        </div>
      )}

      {result.eliminated?.length > 0 && (
        <div>
          <p className="opacity-75 mb-0.5">Ruled out</p>
          <ul className="space-y-0.5">
            {result.eliminated.map((item) => (
              <li key={item.id}>✗ {item.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
