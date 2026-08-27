'use client';

import Link from 'next/link';
import {
  FaChartBar,
  FaClipboardList,
  FaSearch,
  FaWrench,
} from 'react-icons/fa';

const TILES = [
  {
    href: '/solomon/diagnostics',
    label: 'My diagnostics',
    subtitle: 'View and manage your past diagnostics',
    icon: FaClipboardList,
    accent: 'bg-cyan-400',
    iconBg: 'bg-cyan-500/15 text-cyan-400',
  },
  {
    href: '/solomon/outcomes',
    labelKey: 'outcomes',
    subtitle: 'Record and review completed repairs',
    icon: FaWrench,
    accent: 'bg-orange-400',
    iconBg: 'bg-orange-500/15 text-orange-400',
  },
  {
    href: '/solomon/knowledge',
    label: 'Repair memory search',
    subtitle: 'Search your historical repair knowledge',
    icon: FaSearch,
    accent: 'bg-purple-400',
    iconBg: 'bg-purple-500/15 text-purple-400',
  },
  {
    hrefKey: 'performance',
    label: 'Performance',
    subtitle: 'Your stats, accuracy and insights',
    icon: FaChartBar,
    accent: 'bg-emerald-400',
    iconBg: 'bg-emerald-500/15 text-emerald-400',
  },
];

function MenuTile({ href, label, subtitle, icon: Icon, accent, iconBg }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-white/10 bg-[#0D1525]/88 backdrop-blur-sm px-2.5 py-2 hover:border-white/20 transition-colors overflow-hidden"
    >
      <div className={`h-0.5 w-full rounded-full ${accent} opacity-80 mb-1.5`} />
      <div className="flex items-center gap-2 min-w-0">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
          <Icon size={12} />
        </span>
        <span className="text-xs font-semibold text-white leading-tight truncate">{label}</span>
      </div>
      <p className="text-[10px] text-gray-500 mt-1 leading-snug line-clamp-2 pl-0">
        {subtitle}
      </p>
    </Link>
  );
}

export default function SolomonHomeMenuGrid({ isDiyer, isStaff }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TILES.map((tile) => {
        const href = tile.hrefKey === 'performance'
          ? (isStaff ? '/techdashboard/performance' : '/solomon/outcomes')
          : tile.href;
        const label = tile.labelKey === 'outcomes'
          ? (isDiyer ? 'Repair notes' : 'Repair outcomes')
          : tile.label;

        return (
          <MenuTile
            key={tile.label || tile.labelKey}
            href={href}
            label={label}
            subtitle={tile.subtitle}
            icon={tile.icon}
            accent={tile.accent}
            iconBg={tile.iconBg}
          />
        );
      })}
    </div>
  );
}
