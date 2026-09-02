// TechDashboardLayout v4 - Switchable Rail Position
import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserRole } from '../../utils/auth0-helpers';
import { apiClient } from '../../utils/api-client';
import { ensureWebPushSubscription } from '../../utils/webPush';
import { startDeployReminderHeartbeat, stopDeployReminderHeartbeat } from '../../lib/deployReminderScheduler';
import { useUIPreferences } from '../../context/UIPreferencesContext';
import { resolveUserDisplayName, resolveUserInitial } from '../../utils/userDisplayName';
import TechIconRail from '../navigation/TechIconRail';

import {
  TECH_ICON_ASPECT,
  TECH_ICON_PARTS,
  TECH_ICON_VIEWBOX,
} from '../../constants/techIconRail';

/** Filled silhouette: a few px wider than stroke icons (30) so optical size matches */
const TECH_RAIL_NAV_ICON_W_PX = 36;
const RAIL_WIDTH_COLLAPSED = 76;
const RAIL_WIDTH_EXPANDED = 220;
const RAIL_SLIDE_MS = 280;
const RAIL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

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
    name: 'Repair Memory',
    href: '/techdashboard/dma',
    color: 'orange',
    icon: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></>),
  },
  {
    name: 'Performance',
    href: '/techdashboard/performance',
    color: 'orange',
    icon: (<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>),
  },
  {
    name: 'Clients',
    href: '/techboard/assets',
    color: 'cyan',
    icon: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  },
  {
    name: 'Technicians',
    href: '/techboard/operatives',
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

const TechDashboardRailContext = createContext(null);

export function useTechDashboardRail() {
  return useContext(TechDashboardRailContext);
}

export default function TechDashboardLayout({ children }) {
  const [railOpen, setRailOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sweepingItem, setSweepingItem] = useState(null);
  const profileRef = useRef(null);
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { preferences } = useUIPreferences();
  const displayName = resolveUserDisplayName({ preferences, user });
  const displayInitial = resolveUserInitial({ preferences, user });
  
  // Rail position from user preferences (default: 'right')
  const railPosition = preferences.railPosition || 'right';
  const isRailOnRight = railPosition === 'right';

  // Role-based access control - redirect clients to their portal
  useEffect(() => {
    if (isLoading || !user) return;
    
    const role = getUserRole(user);
    const allowedRoles = ['admin', 'manager', 'technician'];
    
    if (!allowedRoles.includes(role)) {
      console.log('[TechDashboardLayout] Client role detected, redirecting to portal');
      router.replace('/cxdashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || !user) return undefined;
    const role = getUserRole(user);
    if (!['admin', 'manager', 'technician'].includes(role)) return undefined;
    ensureWebPushSubscription(apiClient);
    return undefined;
  }, [user, isLoading]);

  useEffect(() => {
    if (isLoading || !user) return undefined;
    const role = getUserRole(user);
    if (!['admin', 'manager', 'technician'].includes(role)) return undefined;
    startDeployReminderHeartbeat(apiClient);
    return () => stopDeployReminderHeartbeat();
  }, [user, isLoading]);

  const railWidth = expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED;
  const railSlideTransition = `transform ${RAIL_SLIDE_MS}ms ${RAIL_EASE}`;
  const railWidthTransition = expanded ? `width ${RAIL_SLIDE_MS}ms ${RAIL_EASE}` : 'none';

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

  const openRail = useCallback(() => {
    setRailOpen(true);
    setExpanded(false);
  }, []);

  return (
    <TechDashboardRailContext.Provider value={{ openRail }}>
    <div className="min-h-screen" style={{ background: '#0A0F1E' }}>
      <style>{`
        .hud-tactical-column {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .hud-grid-content {
          pointer-events: none;
        }
        .hud-grid-content [data-hud-card],
        .hud-grid-content [data-techboard-card],
        .hud-grid-content [data-touch-surface],
        .hud-grid-content [data-action-menu],
        .hud-grid-content nav,
        .hud-grid-content a,
        .hud-grid-content button,
        .hud-grid-content input,
        .hud-grid-content select,
        .hud-grid-content textarea,
        .hud-grid-content label {
          pointer-events: auto;
        }
        
        /* Rail nav item sweep effect */
        .rail-nav-item {
          position: relative;
          overflow: hidden;
        }
        
        .rail-nav-sweep {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(0, 212, 255, 0.5) 88%,
            transparent 100%
          );
          opacity: 0;
          transform: translateX(-100%);
          pointer-events: none;
          z-index: 1;
        }
        
        .rail-nav-sweep.orange {
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 122, 0, 0.5) 50%,
            transparent 100%
          );
        }
        
        .rail-nav-item.sweeping .rail-nav-sweep {
          opacity: 1;
          animation: rail-sweep 0.5s ease-out forwards;
        }
        
        @keyframes rail-sweep {
          0% { transform: translateX(-100%); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header 
        className={`fixed left-0 right-0 flex items-center justify-between px-4 ${isRailOnRight ? 'flex-row-reverse' : ''}`}
        style={{ 
          top: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          minHeight: 'calc(72px + env(safe-area-inset-top, 0px))',
          height: 'auto',
          background: '#0D1525', 
          borderBottom: '1px solid rgba(255,255,255,0.07)', 
          zIndex: 1200
        }}
      >
        {/* Hamburger - position flips with rail */}
        <button
          onClick={() => { setRailOpen(true); setExpanded(false); }}
          className={`w-14 h-14 flex items-center justify-center rounded-lg active:opacity-70 transition-opacity ${isRailOnRight ? '-mr-2' : '-ml-2'}`}
          style={{ background: railOpen ? 'rgba(34,211,238,0.1)' : 'transparent' }}
          aria-label="Open navigation menu"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" style={{ stroke: '#9CA3AF', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Center logo */}
        <img src="/idimslogo.png?v=2" alt="IDIMS" className="h-10 w-auto absolute left-1/2 -translate-x-1/2" />

        {/* Notifications + Profile - position flips with rail */}
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
                  {displayInitial}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <div 
                className={`absolute mt-2 w-56 rounded-lg shadow-lg overflow-hidden ${isRailOnRight ? 'left-0' : 'right-0'}`}
                style={{ 
                  background: '#0D1525', 
                  border: '1px solid rgba(34,211,238,0.3)',
                  boxShadow: '0 0 20px rgba(0,212,255,0.1)'
                }}
              >
                {/* User Info */}
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
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

      {/* ── LEFT-SIDE RAIL (Original) ── */}
      {!isRailOnRight && (<div
        className="fixed inset-0 z-[1190]"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: railOpen ? 1 : 0,
          pointerEvents: railOpen ? 'auto' : 'none',
          transition: `opacity ${RAIL_SLIDE_MS}ms ease-out`,
        }}
        onClick={() => setRailOpen(false)}
        aria-hidden={!railOpen}
      />)}

      {!isRailOnRight && (<div
        className="fixed left-0 bottom-0 flex flex-col z-[1195]"
        style={{
          top: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          width: railWidth,
          background: '#0D1525',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
          transform: railOpen ? 'translate3d(0, 0, 0)' : `translate3d(-${railWidth}px, 0, 0)`,
          transition: railOpen
            ? `${railSlideTransition}, ${railWidthTransition}`
            : railSlideTransition,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
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
            const isSweeping = sweepingItem === item.name;

            const handleClick = (e) => {
              e.preventDefault();
              setSweepingItem(item.name);
              setTimeout(() => {
                setSweepingItem(null);
                setRailOpen(false);
                router.push(item.href);
              }, 500);
            };

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleClick}
                className={`rail-nav-item flex items-center min-h-[52px] py-3.5 transition-all active:opacity-70 ${isSweeping ? 'sweeping' : ''}`}
                style={{
                  paddingLeft: expanded ? 16 : 12,
                  paddingRight: expanded ? 12 : 12,
                  gap: expanded ? 14 : 0,
                  background: active ? 'rgba(34,211,238,0.06)' : 'transparent',
                  borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
                }}
              >
                {/* Sweep overlay */}
                <div className={`rail-nav-sweep ${item.color === 'orange' ? 'orange' : ''}`} />
                <div className="flex items-center justify-center flex-shrink-0 relative z-10" style={{ width: 44, height: 44 }}>
                  {item.href === '/techboard/operatives' ? (
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
                  <span className="relative z-10 text-base font-medium leading-tight whitespace-nowrap transition-all pr-1" style={{ color, textShadow: active ? (item.color === 'orange' ? '0 0 8px rgba(255,122,0,0.4)' : '0 0 8px rgba(0,212,255,0.4)') : 'none' }}>
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Expand/collapse arrow */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
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
      </div>)}

      {/* ── RIGHT-SIDE ICON RAIL (New) ── */}
      {isRailOnRight && (
        <TechIconRail 
          isOpen={railOpen} 
          onClose={() => setRailOpen(false)} 
        />
      )}

      {/* ── PAGE CONTENT ── */}
      <main style={{ 
        paddingTop: 'calc(72px + env(safe-area-inset-top, 0px))',
      }}>
        {children}
      </main>
    </div>
    </TechDashboardRailContext.Provider>
  );
}
