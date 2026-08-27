'use client';

import Link from 'next/link';
import {
  FaChartBar,
  FaClipboardList,
  FaSearch,
  FaWrench,
} from 'react-icons/fa';

function MenuTile({ href, label, icon: Icon, subtitle }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D1525]/90 backdrop-blur-sm px-3 py-4 min-h-[104px] text-center hover:border-cyan-500/30 hover:bg-[#0D1525] transition-colors"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
        <Icon size={18} />
      </span>
      <span className="text-sm font-medium text-white leading-tight">{label}</span>
      {subtitle ? (
        <span className="text-[10px] text-gray-500 leading-tight">{subtitle}</span>
      ) : null}
    </Link>
  );
}

export default function SolomonHomeMenuGrid({ isDiyer, isStaff }) {
  const items = [
    {
      href: '/solomon/diagnostics',
      label: 'My diagnostics',
      icon: FaClipboardList,
    },
    {
      href: '/solomon/outcomes',
      label: isDiyer ? 'Repair notes' : 'Repair outcomes',
      icon: FaWrench,
    },
    {
      href: '/solomon/knowledge',
      label: 'Repair memory search',
      icon: FaSearch,
    },
    {
      href: isStaff ? '/techdashboard/performance' : '/solomon/outcomes',
      label: 'Performance',
      icon: FaChartBar,
      subtitle: isStaff ? 'Field metrics' : 'Your outcomes',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <MenuTile key={item.href + item.label} {...item} />
      ))}
    </div>
  );
}
