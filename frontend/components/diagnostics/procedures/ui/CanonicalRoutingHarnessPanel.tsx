import type { CanonicalRoutingResult } from '../../knowledge/canonical/canonicalTypes';
import type { ProcedureRecommendation } from '../recommendServiceProcedures';

interface CanonicalRoutingHarnessPanelProps {
  routing: CanonicalRoutingResult | null;
  platformId: string | null;
  recommendations: ProcedureRecommendation[];
}

export default function CanonicalRoutingHarnessPanel({
  routing,
  platformId,
  recommendations,
}: CanonicalRoutingHarnessPanelProps) {
  if (!routing) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/30 px-3 py-3">
        <p className="text-xs text-[var(--solomon-text-muted)]">
          Canonical routing is not available for this template yet.
        </p>
      </div>
    );
  }

  const canonicalRanked = recommendations.filter((item) => (item.canonicalBoost || 0) > 0);

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40 px-3 py-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--solomon-text-muted)]">
          Canonical graph
        </p>
        <p className="mt-1 text-sm font-medium text-[var(--solomon-text-primary)]">
          {routing.ontologyLabel}
          <span className="ml-2 text-xs font-normal text-[var(--solomon-text-secondary)]">
            ({routing.ontologyId})
          </span>
        </p>
        {platformId ? (
          <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)]">
            Platform {platformId}
            {routing.overlayProcedureCount
              ? ` · ${routing.overlayProcedureCount} procedures mapped`
              : ''}
            {routing.unmappedProcedureCount
              ? ` · ${routing.unmappedProcedureCount} without domain overlay`
              : ''}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--solomon-text-muted)]">
          Entry points
        </p>
        {routing.matchedEntryPoints.length ? (
          <ul className="mt-1 space-y-1 text-xs text-[var(--solomon-text-secondary)]">
            {routing.matchedEntryPoints.map((entry) => (
              <li
                key={entry.entryPointId}
                className="rounded border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-2 py-1.5"
              >
                <span className="font-medium text-[var(--solomon-text-primary)]">
                  {entry.entryPointId}
                </span>
                <span className="ml-2 text-[10px] text-[var(--solomon-text-muted)]">
                  via {entry.matchedBy.join(', ')} ({entry.matchDetail})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[var(--solomon-text-muted)]">
            No entry point matched — select complaint chips or enter error codes.
          </p>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--solomon-text-muted)]">
          Active failure domains
        </p>
        {routing.activeDomains.length ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {routing.activeDomains.map((domainId) => (
              <span
                key={domainId}
                className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-100"
              >
                {routing.domainLabels[domainId] || domainId}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-[var(--solomon-text-muted)]">—</p>
        )}
      </div>

      {routing.suggestedComponents.length ? (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--solomon-text-muted)]">
            Suggested components
          </p>
          <p className="mt-1 text-xs text-[var(--solomon-text-secondary)]">
            {routing.suggestedComponents.join(', ')}
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--solomon-text-muted)]">
          Canonical-boosted procedures
        </p>
        {canonicalRanked.length ? (
          <ol className="mt-1 space-y-1 text-xs text-[var(--solomon-text-secondary)]">
            {canonicalRanked.slice(0, 8).map((item) => (
              <li
                key={item.procedureId}
                className="rounded border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-2 py-1.5"
              >
                <span className="font-medium text-[var(--solomon-text-primary)]">
                  {item.procedure.title}
                </span>
                <span className="ml-2 text-[10px] text-emerald-300">
                  +{item.canonicalBoost} canonical
                </span>
                {item.canonicalDomainMatches?.length ? (
                  <p className="mt-0.5 text-[10px] text-[var(--solomon-text-muted)]">
                    domains: {item.canonicalDomainMatches.join(', ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-xs text-[var(--solomon-text-muted)]">
            No procedures received a canonical domain boost for this input.
          </p>
        )}
      </div>
    </div>
  );
}
