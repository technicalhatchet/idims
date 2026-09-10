'use client';

import { useMemo, useState } from 'react';
import { listPlatformServiceModeQuickReference } from '../procedureRegistry';
import { SERVICE_MODE_KIND_LABELS } from '../serviceModeCatalog';
import type { ServiceModeBundle } from '../types';

interface ServiceModeQuickReferenceAccordionProps {
  platformId?: string | null;
  density?: 'default' | 'compact';
  className?: string;
}

function ServiceModeCard({ bundle }: { bundle: ServiceModeBundle }) {
  const kindLabel = SERVICE_MODE_KIND_LABELS[bundle.modeKind] || bundle.modeKind;

  return (
    <article
      className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-[var(--solomon-text-primary)]">{bundle.title}</p>
        <span className="shrink-0 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
          {kindLabel}
        </span>
      </div>
      {bundle.description ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--solomon-text-secondary)]">
          {bundle.description}
        </p>
      ) : null}
      <ol className="mt-2 space-y-2">
        {bundle.steps.map((step, index) => (
          <li key={step.id} className="text-xs leading-relaxed text-[var(--solomon-text-secondary)]">
            <span className="font-medium text-[var(--solomon-text-primary)]">
              {index + 1}. {step.title}
            </span>
            {step.body ? (
              <p className="mt-0.5 whitespace-pre-wrap">{step.body}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </article>
  );
}

export default function ServiceModeQuickReferenceAccordion({
  platformId,
  density = 'default',
  className = '',
}: ServiceModeQuickReferenceAccordionProps) {
  const bundles = useMemo(
    () => (platformId ? listPlatformServiceModeQuickReference(platformId) : []),
    [platformId],
  );
  const [open, setOpen] = useState(false);
  const isCompact = density === 'compact';

  if (!bundles.length) return null;

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2.5 text-left hover:bg-[var(--solomon-surface-elevated)]/60"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--solomon-text-primary)]">
            Service &amp; test mode reference
          </p>
          <p className="mt-0.5 text-xs text-[var(--solomon-text-secondary)]">
            Diagnostic entry, test mode, and activation steps
          </p>
        </div>
        <span className="shrink-0 text-xs text-[var(--solomon-text-muted)]">
          {open ? 'Hide' : `${bundles.length} mode${bundles.length === 1 ? '' : 's'}`}
        </span>
      </button>

      {open ? (
        <div className={`space-y-2 ${isCompact ? 'mt-2' : 'mt-2.5'}`}>
          {bundles.map((bundle) => (
            <ServiceModeCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
