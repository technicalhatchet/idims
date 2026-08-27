'use client';

import Link from 'next/link';
import {
  FaBrain,
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
    icon: FaClipboardList,
    accent: 'bg-orange-400',
    iconBg: 'bg-orange-500/15 text-orange-400',
    useWrench: true,
  },
  {
    href: '/solomon/knowledge',
    label: 'Repair memory search',
    subtitle: 'Search your historical repair knowledge',
    icon: FaSearch,
    accent: 'bg-purple-400',
    iconBg: 'bg-purple-500/15 text-purple-400',
    useBrain: true,
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

function MenuTile({ href, label, subtitle, icon: Icon, accent, iconBg, useWrench, useBrain }) {
  const TileIcon = useWrench ? FaWrench : useBrain ? FaBrain : Icon;

  return (
    <Link
      href={href}
      className="flex flex-col rounded-xl border border-white/10 bg-[#0D1525]/88 backdrop-blur-sm px-2.5 py-2 hover:border-white/20 transition-colors overflow-hidden"
    >
      <div className={`h-0.5 w-full rounded-full ${accent} opacity-80 mb-2`} />
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
        <TileIcon size={14} />
      </span>
      <span className="text-xs font-semibold text-white mt-1.5 leading-tight">{label}</span>
      <span className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
        {subtitle}
      </span>
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
            useWrench={tile.useWrench}
            useBrain={tile.useBrain}
          />
        );
      })}
    </div>
  );
}
