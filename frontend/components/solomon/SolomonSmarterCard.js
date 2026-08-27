'use client';

import Link from 'next/link';
import { FaLightbulb, FaStar } from 'react-icons/fa';

function AccuracyRing({ percent }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const stars = Math.min(5, Math.max(0, Math.round(clamped / 20)));

  return (
    <div className="shrink-0 text-center">
      <div
        className="relative mx-auto h-12 w-12 rounded-full border-2 border-orange-400/50 flex items-center justify-center"
        style={{
          background: `conic-gradient(#f59e0b ${clamped * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      >
        <span className="absolute inset-[3px] rounded-full bg-[#0D1525] flex items-center justify-center text-[11px] font-bold text-orange-300 tabular-nums">
          {clamped}%
        </span>
      </div>
      <p className="text-[9px] text-gray-500 mt-1">Overall accuracy</p>
      <div className="flex justify-center gap-0.5 mt-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <FaStar
            key={i}
            size={8}
            className={i < stars ? 'text-orange-400' : 'text-white/15'}
          />
        ))}
      </div>
      <p className="text-[9px] text-gray-500">Last 30 days</p>
    </div>
  );
}

export default function SolomonSmarterCard({ isDiyer, accuracyPercent }) {
  const showAccuracy = typeof accuracyPercent === 'number' && accuracyPercent > 0;

  return (
    <div className="rounded-xl border border-orange-500/25 bg-[#0D1525]/88 backdrop-blur-sm px-3 py-2.5 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
        <FaLightbulb size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-orange-300">Smarter every time.</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
          {isDiyer
            ? 'Your diagnostics build your repair memory, making you faster and more accurate.'
            : 'Your diagnostics build your repair memory, making you faster and more accurate.'}
        </p>
        {!showAccuracy ? (
          <Link
            href="/solomon/knowledge"
            className="text-[10px] text-cyan-400 mt-1 inline-block hover:text-cyan-300"
          >
            Explore repair memory →
          </Link>
        ) : null}
      </div>
      {showAccuracy ? <AccuracyRing percent={accuracyPercent} /> : null}
    </div>
  );
}
