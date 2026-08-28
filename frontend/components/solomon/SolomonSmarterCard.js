'use client';

import Link from 'next/link';

const LAYERS = [
  { width: '32%', glow: 'shadow-[0_0_6px_rgba(34,211,238,0.2)]', border: 'border-cyan-400/45', bg: 'bg-cyan-500/12' },
  { width: '48%', glow: '', border: 'border-cyan-400/35', bg: 'bg-cyan-500/10' },
  { width: '64%', glow: '', border: 'border-cyan-400/28', bg: 'bg-gradient-to-b from-cyan-500/10 to-cyan-500/05' },
  { width: '80%', glow: '', border: 'border-orange-400/28', bg: 'bg-gradient-to-b from-cyan-500/08 to-orange-500/10' },
  { width: '100%', glow: 'shadow-[0_0_10px_rgba(249,115,22,0.15)]', border: 'border-orange-400/35', bg: 'bg-orange-500/10' },
];

function KnowledgePyramidVisual() {
  return (
    <div className="shrink-0 flex flex-col items-center justify-end h-[3.5rem] w-12" aria-hidden>
      <span
        className="text-[11px] leading-none text-cyan-200 mb-0.5"
        style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.85)) drop-shadow(0 0 10px rgba(249,115,22,0.35))' }}
      >
        ✦
      </span>
      <div className="flex flex-col items-center gap-[3px] w-full">
        {LAYERS.map((layer, index) => (
          <div
            key={index}
            className={`h-[5px] rounded-[2px] border ${layer.border} ${layer.bg} ${layer.glow}`}
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
