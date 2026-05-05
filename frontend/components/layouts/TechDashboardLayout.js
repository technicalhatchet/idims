// TechDashboardLayout v2
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { FaBars } from 'react-icons/fa';
import NotificationsDropdown from '../notifications/NotificationsDropdown';
import UserDropdown from '../user/UserDropdown';
import ErrorBoundary from '../../context/ErrorBoundary';

// ── Nav Icons (custom SVGs to match our aesthetic) ────────────────────────
const NAV_ITEMS = [
  {
    name: 'Tech Dashboard',
    href: '/techdashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    name: 'Work Orders',
    href: '/work_orders',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    name: 'Schedule',
    href: '/schedule',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    name: "Today's Route",
    href: '/techdashboard/route',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    ),
  },
  {
    name: 'Clients',
    href: '/clients',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    name: 'Technicians',
    href: '/technicians',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M20 21a8 8 0 1 0-16 0"/>
        <line x1="12" y1="16" x2="12" y2="21"/>
        <line x1="9" y1="18" x2="15" y2="18"/>
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export default function TechDashboardLayout({ children }) {
  const [railOpen, setRailOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const { user } = useUser();

  const railWidth = expanded ? 200 : 64;

  const isActive = (href) => {
    if (href === '/techdashboard') return router.pathname === '/techdashboard';
    return router.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0A0F1E' }}>

      {/* ── HEADER ── */}
      <header className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4" style={{ background: '#0D1525', borderBottom: '1px solid rgba(255,255,255,0.07)', zIndex: 50 }}>
        {/* Hamburger — bigger touch target */}
        <button
          onClick={() => { setRailOpen(true); setExpanded(false); }}
          className="w-10 h-10 flex items-center justify-center rounded-lg active:opacity-70 transition-opacity"
          style={{ background: railOpen ? 'rgba(34,211,238,0.1)' : 'transparent' }}
          aria-label="Open menu"
        >
          <FaBars className="text-gray-400" style={{ fontSize: 20 }} />
        </button>

        {/* Center logo */}
        <img src="/arpano.png" alt="Atomic Repair" className="h-7 w-auto absolute left-1/2 -translate-x-1/2" />

        {/* Right icons */}
        <div className="flex items-center gap-3">
          <ErrorBoundary>
            <NotificationsDropdown />
          </ErrorBoundary>
          <ErrorBoundary>
            {typeof UserDropdown === 'function' && <UserDropdown user={user} />}
          </ErrorBoundary>
        </div>
      </header>

      {/* ── OVERLAY (backdrop) ── */}
      {railOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setRailOpen(false)}
        />
      )}

      {/* ── ICON RAIL ── */}
      <div
        className="fixed top-0 left-0 bottom-0 flex flex-col z-50 transition-all duration-300 ease-in-out"
        style={{
          width: railOpen ? railWidth : 0,
          background: '#0D1525',
          borderRight: railOpen ? '1px solid rgba(255,255,255,0.07)' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Logo area */}
        <div className="flex items-center justify-center py-4 flex-shrink-0" style={{ height: 72, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {expanded ? (
            <img src="/arpano.png" alt="Atomic Repair" style={{ height: 36, width: 'auto', maxWidth: 160 }} />
          ) : (
            <img src="/atomwrenches.png" alt="AR" style={{ height: 36, width: 36, objectFit: 'contain' }} />
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const isCyan = ['Tech Dashboard', 'Work Orders', 'Schedule', "Today's Route"].includes(item.name);
            const color = active
              ? (isCyan ? '#00D4FF' : '#FF7A00')
              : 'rgba(255,255,255,0.35)';
            const glowFilter = active
              ? (isCyan ? 'drop-shadow(0 0 5px rgba(0,212,255,0.7))' : 'drop-shadow(0 0 5px rgba(255,122,0,0.7))')
              : 'none';

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setRailOpen(false)}
                className="flex items-center py-3 transition-all active:opacity-70"
                style={{
                  paddingLeft: expanded ? 20 : 20,
                  paddingRight: expanded ? 16 : 20,
                  gap: expanded ? 12 : 0,
                  background: active ? 'rgba(34,211,238,0.06)' : 'transparent',
                  borderLeft: active ? `2px solid ${color}` : '2px solid transparent',
                }}
              >
                <div style={{ width: 24, height: 24, flexShrink: 0 }}>
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
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
                    {item.icon.props.children}
                  </svg>
                </div>
                {expanded && (
                  <span className="text-sm font-medium whitespace-nowrap transition-all" style={{ color, textShadow: active && isCyan ? '0 0 8px rgba(0,212,255,0.4)' : active ? '0 0 8px rgba(255,122,0,0.4)' : 'none' }}>
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
            className="flex items-center justify-center w-full py-3 active:opacity-70 transition-opacity"
            style={{ gap: expanded ? 8 : 0 }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              style={{
                stroke: 'rgba(255,255,255,0.3)',
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
            {expanded && <span className="text-xs text-gray-500">Collapse</span>}
          </button>
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <main className="pt-14">
        {children}
      </main>
    </div>
  );
}
