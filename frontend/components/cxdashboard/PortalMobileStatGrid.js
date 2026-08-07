import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';

/**
 * Compact 2×2 stat grid for client portal home on mobile (replaces stacked hero tiles).
 */
export default function PortalMobileStatGrid({ stats = [] }) {
  if (!stats.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const highlight = stat.highlight;
        return (
          <Link
            key={stat.title}
            href={stat.href || '#'}
            className={`group block rounded-xl border p-3 transition-colors touch-manipulation active:opacity-90 ${
              highlight
                ? 'border-orange-500/30 bg-orange-500/[0.08]'
                : 'border-white/[0.08] bg-[#0E1825]/80'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  highlight ? 'bg-orange-500/20' : 'bg-cyan-500/10'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-orange-400' : 'text-cyan-400'}`} />
              </div>
              <FaArrowRight className="w-3 h-3 text-white/20 group-hover:text-cyan-400/80 shrink-0 mt-0.5 transition-colors" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45 mt-2.5 leading-tight">
              {stat.title}
            </p>
            <p
              className={`text-xl font-semibold mt-0.5 tabular-nums leading-none ${
                highlight ? 'text-orange-400' : 'text-white'
              }`}
            >
              {stat.value}
            </p>
            {stat.subtitle && (
              <p className="text-[11px] text-white/40 mt-1 line-clamp-2 leading-snug">{stat.subtitle}</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
