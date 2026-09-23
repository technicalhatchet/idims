'use client';

import { useState } from 'react';

interface ProcedureStepSourceReferenceProps {
  sourceExcerpt?: string | null;
  showSourceInAccordion?: boolean;
}

/** Standalone source toggle when excerpt is not folded into technical details. */
export default function ProcedureStepSourceReference({
  sourceExcerpt,
  showSourceInAccordion = false,
}: ProcedureStepSourceReferenceProps) {
  const [open, setOpen] = useState(false);
  const excerpt = sourceExcerpt?.trim();
  if (!excerpt || showSourceInAccordion) return null;

  return (
    <section className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-[var(--solomon-text-primary)]">Source</span>
        <span className="text-[10px] text-[var(--solomon-text-muted)]">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open ? (
        <blockquote className="border-t border-[color:var(--solomon-border-subtle)] px-3 py-2 text-xs italic leading-relaxed text-[var(--solomon-text-secondary)]">
          {excerpt}
        </blockquote>
      ) : null}
    </section>
  );
}
