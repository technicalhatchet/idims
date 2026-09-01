'use client';

import useSolomonTheme from '../../hooks/useSolomonTheme';

/** Shared dark background for Solomon list/search pages — restrained, no hero art. */
export default function SolomonPageAtmosphere() {
  const { isProfessional } = useSolomonTheme();

  if (isProfessional) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -left-16 h-48 w-48 rounded-full bg-cyan-500/[0.04] blur-3xl" />
      <div className="absolute top-1/3 -right-16 h-40 w-40 rounded-full bg-purple-500/[0.035] blur-3xl" />
      <div className="absolute bottom-28 left-6 h-32 w-32 rounded-full bg-orange-500/[0.03] blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--solomon-bg-canvas)]/30 via-transparent to-[var(--solomon-bg-canvas)]/50" />
    </div>
  );
}
