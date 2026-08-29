'use client';

import Link from 'next/link';

const LAYERS = [
  { width: '32%', class: 'bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.65)]' },
  { width: '48%', class: 'bg-cyan-400/40' },
  { width: '64%', class: 'bg-white/75' },
  { width: '80%', class: 'bg-white/50' },
  { width: '100%', class: 'bg-orange-400/70 shadow-[0_0_8px_rgba(249,115,22,0.3)]' },
];

function KnowledgePyramidVisual() {
  return (
    <div className="shrink-0 flex flex-col items-center justify-end h-[3.75rem] w-12" aria-hidden>
      <span
        className="text-[11px] leading-none text-cyan-200 mb-1"
        style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.85)) drop-shadow(0 0 10px rgba(249,115,22,0.35))' }}
      >
        ✦
      </span>
      <div className="flex flex-col items-center gap-[5px] w-full">
        {LAYERS.map((layer, index) => (
          <div
            key={index}
            className={`h-[2.5px] rounded-full ${layer.class}`}
            style={{ width: layer.width }}
          />
        ))}
      </div>
    </div>
  );
}

export default function SolomonSmarterCard({ isDiyer }) {
  return (
    <div className="rounded-xl border border-orange-500/30 bg-[#060a12]/78 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] px-3 py-2.5 flex items-start gap-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-orange-300">Smarter every time.</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
          {isDiyer
            ? 'Your diagnostics build your repair memory, making you faster and more accurate.'
            : 'Your diagnostics build your repair memory, making you faster and more accurate.'}
        </p>
        <Link
          href="/solomon/knowledge"
          className="text-[10px] text-cyan-400 mt-1 inline-block hover:text-cyan-300"
        >
          Explore repair memory →
        </Link>
      </div>
      <KnowledgePyramidVisual />
    </div>
  );
}
