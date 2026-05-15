// TechDashboardLayout v2
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';

import {
  TECH_ICON_ASPECT,
  TECH_ICON_PARTS,
  TECH_ICON_VIEWBOX,
} from '../../constants/techIconRail';

/** Filled silhouette: a few px wider than stroke icons (30) so optical size matches */
const TECH_RAIL_NAV_ICON_W_PX = 36;

// ── Nav Icons (custom SVGs to match our aesthetic) ────────────────────────
const NAV_ITEMS = [
  {
    name: 'Tech Dashboard',
    href: '/techboard',
    color: 'cyan',
    icon: (<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>),
  },
  {
    name: 'Work Orders',
    href: '/work_orders/test',
    color: 'cyan',
    icon: (<><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="8" y="2.5" width="8" height="4" rx="1.5"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16" x2="13" y2="16"/></>),
  },
  {
    name: 'Schedule',
    href: '/schedule-test',
    color: 'cyan',
    icon: (<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  },
  {
    name: "Today's Route",
    href: '/techdashboard/route',
    color: 'cyan',
    icon: (<><polygon points="3 11 22 2 13 21 11 13 3 11"/></>),
  },
  {
    name: 'Clients',
    href: '/clients',
    color: 'cyan',
    icon: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  },
  {
    name: 'Technicians',
    href: '/technicians',
    color: 'orange',
    icon: null,
  },
  {
    name: 'Settings',
    href: '/settings',
    color: 'orange',
    icon: (<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
  },
];

export default function TechDashboardLayout({ children }) {
  const [railOpen, setRailOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const router = useRouter();
  const { user } = useUser();

  const railWidth = expanded ? 220 : 76;

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href) => {
    if (href === '/techboard') return router.pathname === '/techboard';
    return router.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0A0F1E' }}>

      {/* ── HEADER ── */}
      <header className="fixed top-0 left-0 right-0 flex items-center justify-between px-4" style={{ height: 72, background: '#0D1525', borderBottom: '1px solid rgba(255,255,255,0.07)', zIndex: 1200 }}>
        {/* Hamburger */}
        <button
          onClick={() => { setRailOpen(true); setExpanded(false); }}
          className="w-11 h-11 flex items-center justify-center rounded-lg active:opacity-70 transition-opacity"
          style={{ background: railOpen ? 'rgba(34,211,238,0.1)' : 'transparent' }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" style={{ stroke: '#9CA3AF', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Center logo */}
        <img src="/arpano.png" alt="Atomic Repair" className="h-8 w-auto absolute left-1/2 -translate-x-1/2" />

        {/* Right — Notifications + Profile */}
        <div className="flex items-center gap-2">
          {/* Notifications Bell */}
          <button
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all overflow-hidden"
              style={{ 
                background: profileOpen ? 'rgba(34,211,238,0.15)' : 'rgba(34,211,238,0.1)',
                border: profileOpen ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(34,211,238,0.3)',
              }}
            >
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold" style={{ color: '#22D3EE' }}>
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg overflow-hidden"
                style={{ 
                  background: '#0D1525', 
                  border: '1px solid rgba(34,211,238,0.3)',
                  boxShadow: '0 0 20px rgba(0,212,255,0.1)'
                }}
              >
                {/* User Info */}
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    Settings
                  </Link>
                  <Link
                    href="/api/auth/logout"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: '#FF7A00' }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" style={{ stroke: '#FF7A00', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── OVERLAY (backdrop) ── */}
      {railOpen && (
        <div
          className="fixed inset-0 z-[1190]"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setRailOpen(false)}
        />
      )}

      {/* ── ICON RAIL ── */}
      <div
        className="fixed top-0 left-0 bottom-0 flex flex-col transition-all duration-300 ease-in-out z-[1195]"
        style={{
          width: railOpen ? railWidth : 0,
          background: '#0D1525',
          borderRight: railOpen ? '1px solid rgba(255,255,255,0.07)' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Logo area */}
        <div className="flex items-center justify-center flex-shrink-0 px-2" style={{ height: 72, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {expanded ? (
            <img src="/arpano.png" alt="Atomic Repair" style={{ height: 46, width: 'auto', maxWidth: 192 }} />
          ) : (
            <img src="/atomwrenches.png" alt="AR" style={{ height: 46, width: 46, objectFit: 'contain' }} />
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const itemColor = item.color === 'orange' ? '#FF7A00' : '#00D4FF';
            const color = active ? itemColor : 'rgba(34,211,238,0.5)';
            const glowFilter = active
              ? (item.color === 'orange' ? 'drop-shadow(0 0 5px rgba(255,122,0,0.7))' : 'drop-shadow(0 0 5px rgba(0,212,255,0.7))')
              : 'none';

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setRailOpen(false)}
                className="flex items-center min-h-[52px] py-3.5 transition-all active:opacity-70"
                style={{
                  paddingLeft: expanded ? 16 : 12,
                  paddingRight: expanded ? 12 : 12,
                  gap: expanded ? 14 : 0,
                  background: active ? 'rgba(34,211,238,0.06)' : 'transparent',
                  borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
                }}
              >
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44 }}>
                  {item.href === '/technicians' ? (
                    <svg
                      viewBox={TECH_ICON_VIEWBOX}
                      width={TECH_RAIL_NAV_ICON_W_PX}
                      height={Math.round((TECH_RAIL_NAV_ICON_W_PX / TECH_ICON_ASPECT) * 100) / 100}
                      aria-hidden
                      style={{
                        color,
                        fill: 'currentColor',
                        stroke: 'none',
                        filter: glowFilter,
                        transition: 'all 0.2s',
                      }}
                    >
                      {TECH_ICON_PARTS.map(({ d, fillRule, transform: transformAttr }, i) => (
                        <path
                          key={i}
                          d={d}
                          fill="currentColor"
                          transform={transformAttr}
                          fillRule={fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}
                          clipRule={fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}
                        />
                      ))}
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="30"
                      height="30"
                      style={{
                        stroke: color,
                        strokeWidth: 1.75,
                        fill: 'none',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        filter: glowFilter,
                        transition: 'all 0.2s',
                      }}
                    >
                      {item.icon}
                    </svg>
                  )}
                </div>
                {expanded && (
                  <span className="text-base font-medium leading-tight whitespace-nowrap transition-all pr-1" style={{ color, textShadow: active ? (item.color === 'orange' ? '0 0 8px rgba(255,122,0,0.4)' : '0 0 8px rgba(0,212,255,0.4)') : 'none' }}>
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Expand/collapse arrow + logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Expand arrow */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-center w-full min-h-[52px] py-3.5 active:opacity-70 transition-opacity"
            style={{ gap: expanded ? 8 : 0 }}
            aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              style={{
                stroke: 'rgba(255,255,255,0.4)',
                strokeWidth: 2,
                fill: 'none',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
              }}
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            {expanded && <span className="text-sm text-gray-500">Collapse</span>}
          </button>
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <main style={{ paddingTop: 72 }}>
        {children}
      </main>
    </div>
  );
}
