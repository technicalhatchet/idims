import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  TECH_ICON_ASPECT,
  TECH_ICON_PARTS,
  TECH_ICON_VIEWBOX,
} from '../../constants/techIconRail';

const RAIL_WIDTH = 72;
const RAIL_WIDEN = 22; // Widening at dashboard area
const ICON_SIZE = 36;
const ICON_SPACING = 24; // Tighter spacing to fit all icons

const RAIL_SLIDE_MS = 280;
const RAIL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const ACCENT_CYAN = '#22D3EE';
const ACCENT_ORANGE = '#FF7A1A';
const RAIL_BG = '#0B0F1A';
const RAIL_BG_LIGHTER = '#111827';

const NAV_ITEMS = [
  {
    id: 'settings',
    name: 'Settings',
    href: '/settings',
    color: 'orange',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
  {
    id: 'technicians',
    name: 'Technicians',
    href: '/techboard/operatives',
    color: 'orange',
    icon: null, // Uses custom tech icon
  },
  {
    id: 'clients',
    name: 'Clients',
    href: '/techboard/assets',
    color: 'cyan',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    id: 'schedule',
    name: 'Schedule',
    href: '/schedule-test',
    color: 'cyan',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    href: '/techboard',
    color: 'cyan',
    isPrimary: true,
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    id: 'route',
    name: "Today's Route",
    href: '/techdashboard/route',
    color: 'cyan',
    icon: <polygon points="3 11 22 2 13 21 11 13 3 11" />,
  },
  {
    id: 'workorders',
    name: 'Work Orders',
    href: '/work_orders/test',
    color: 'cyan',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <rect x="8" y="2.5" width="8" height="4" rx="1.5" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="16" x2="13" y2="16" />
      </>
    ),
  },
  {
    id: 'performance',
    name: 'Performance',
    href: '/techdashboard/performance',
    color: 'orange',
    icon: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
  },
  {
    id: 'dma',
    name: 'Repair Memory',
    href: '/techdashboard/dma',
    color: 'orange',
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </>
    ),
  },
];

function RailBackground({ height, dashboardCenterY, dashboardActive }) {
  const totalWidth = RAIL_WIDTH + RAIL_WIDEN;
  
  // The arc spans this total height, centered on dashboard
  const arcHeight = 100;
  const arcCenterOffset = -49; // Shift arc down slightly to visually center on icon
  
  const arcCenter = dashboardCenterY + arcCenterOffset;
  const arcTop = arcCenter - arcHeight / 2;
  const arcBottom = arcCenter + arcHeight / 2;
  
  // In SVG: 0 = leftmost edge (max widen), RAIL_WIDEN = normal rail left edge
  const normalLeft = RAIL_WIDEN;
  const maxWiden = 0;
  
  // Path: draws rail with a smooth arc bulge at the dashboard area
  // Uses quadratic bezier for a gentle, symmetrical curve
  const path = `
    M ${totalWidth} 0
    L ${totalWidth} ${height}
    L ${normalLeft} ${height}
    L ${normalLeft} ${arcBottom}
    Q ${maxWiden} ${arcCenter}, ${normalLeft} ${arcTop}
    L ${normalLeft} 0
    Z
  `;
  
  // The arc outline for the accent stroke
  const arcOutline = `
    M ${normalLeft} ${arcBottom}
    Q ${maxWiden} ${arcCenter}, ${normalLeft} ${arcTop}
  `;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={totalWidth}
      height={height}
      style={{ left: -RAIL_WIDEN }}
    >
      <defs>
        <linearGradient id="railGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={RAIL_BG_LIGHTER} />
          <stop offset="100%" stopColor={RAIL_BG} />
        </linearGradient>
        <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Main rail shape - smooth arc widening at dashboard */}
      <path d={path} fill="url(#railGradient)" />
      
      {/* Accent line on the arc edge - brighter when dashboard is active */}
      <path
        d={arcOutline}
        fill="none"
        stroke={ACCENT_CYAN}
        strokeWidth={dashboardActive ? 2.5 : 1}
        opacity={dashboardActive ? 0.9 : 0.3}
        filter={dashboardActive ? 'url(#arcGlow)' : 'none'}
      />
    </svg>
  );
}

export default function TechIconRail({ isOpen, onClose }) {
  const router = useRouter();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [railHeight, setRailHeight] = useState(0);
  const [sweepingItem, setSweepingItem] = useState(null);

  useEffect(() => {
    const updateHeight = () => {
      setRailHeight(window.innerHeight);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const isActive = useCallback((href) => {
    if (href === '/techboard') return router.pathname === '/techboard';
    return router.pathname.startsWith(href);
  }, [router.pathname]);

  const totalIcons = NAV_ITEMS.length;
  const dashboardIndex = NAV_ITEMS.findIndex(item => item.isPrimary);
  const itemHeight = ICON_SIZE + ICON_SPACING * 2;
  const totalNavHeight = totalIcons * itemHeight;
  
  const headerOffset = 72;
  const availableHeight = railHeight - headerOffset;
  const navStartY = headerOffset + (availableHeight - totalNavHeight) / 2;
  const dashboardCenterY = navStartY + (dashboardIndex + 0.5) * itemHeight;

  // Handle nav item click - sweep effect then navigate
  const handleNavClick = (e, item) => {
    e.preventDefault();
    setSweepingItem(item.id);
    setTimeout(() => {
      setSweepingItem(null);
      onClose?.();
      router.push(item.href);
    }, 400);
  };

  const railSlideTransform = isOpen 
    ? 'translate3d(0, 0, 0)' 
    : `translate3d(${RAIL_WIDTH + RAIL_WIDEN}px, 0, 0)`;

  return (
    <>
      <style>{`
        .tech-icon-rail {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          overflow: visible;
        }
        .tech-rail-item {
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .tech-rail-item:hover {
          opacity: 1;
        }
        .tech-rail-item.active {
          background: rgba(34, 211, 238, 0.08);
        }
        .tech-rail-glow {
          filter: drop-shadow(0 0 4px currentColor);
        }
        .tech-rail-glow-dashboard {
          filter: drop-shadow(0 0 4px ${ACCENT_CYAN}) drop-shadow(0 0 8px ${ACCENT_CYAN});
        }
        .rail-nav-sweep {
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(0, 212, 255, 0.5) 50%, transparent 100%);
          opacity: 0;
          transform: translateX(-100%);
          pointer-events: none;
          z-index: 1;
        }
        .rail-nav-sweep.orange {
          background: linear-gradient(120deg, transparent 0%, rgba(255, 122, 0, 0.5) 50%, transparent 100%);
        }
        .tech-rail-item.sweeping .rail-nav-sweep {
          opacity: 1;
          animation: rail-sweep 0.4s ease-out forwards;
        }
        @keyframes rail-sweep {
          0% { transform: translateX(-100%); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
      `}</style>

      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 z-[1190]"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: `opacity ${RAIL_SLIDE_MS}ms ease-out`,
        }}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <nav
        className="tech-icon-rail fixed top-0 bottom-0 right-0 z-[1195] flex flex-col"
        style={{
          width: RAIL_WIDTH,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'transparent',
          overflow: 'visible',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          transform: railSlideTransform,
          transition: `transform ${RAIL_SLIDE_MS}ms ${RAIL_EASE}`,
          willChange: 'transform',
        }}
      >
        {railHeight > 0 && (
          <RailBackground 
            height={railHeight} 
            dashboardCenterY={dashboardCenterY} 
            dashboardActive={isActive('/techboard')}
          />
        )}

        <div
          className="relative flex flex-col items-center justify-center"
          style={{
            marginTop: navStartY,
            gap: ICON_SPACING,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const hovered = hoveredItem === item.id;
            const isDashboard = item.isPrimary;
            const itemColor = item.color === 'orange' ? ACCENT_ORANGE : ACCENT_CYAN;
            
            // Dashboard always shows in accent color (it's home)
            // Other icons: bright when active/hovered, muted otherwise
            const iconColor = isDashboard 
              ? ACCENT_CYAN
              : (active || hovered) 
                ? itemColor 
                : 'rgba(148, 163, 184, 0.5)';

            // Dashboard always has subtle glow, active items get glow
            const glowClass = isDashboard 
              ? 'tech-rail-glow-dashboard'
              : active 
                ? 'tech-rail-glow'
                : '';
            
            // Dashboard icon is ~15% larger
            const iconSize = isDashboard ? Math.round(ICON_SIZE * 1.15) : ICON_SIZE;

            const isSweeping = sweepingItem === item.id;
            
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(e, item)}
                className={`tech-rail-item ${active && !isDashboard ? 'active' : ''} ${isSweeping ? 'sweeping' : ''} flex items-center justify-center relative`}
                style={{
                  width: ICON_SIZE + 16,
                  height: ICON_SIZE + 16,
                  borderRadius: 10,
                }}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                title={item.name}
              >
                {/* Sweep overlay */}
                <div className={`rail-nav-sweep ${item.color === 'orange' ? 'orange' : ''}`} />
                
                {/* Active glow bar on right inside edge */}
                {active && !isDashboard && (
                  <div
                    style={{
                      position: 'absolute',
                      right: -0.7,
                      top: 1,
                      bottom: 1,
                      width: 3.3,
                      borderRadius: 1,
                      background: itemColor,
                      boxShadow: `0 0 6px ${itemColor}, 0 0 6px ${itemColor}`,
                    }}
                  />
                )}
                {item.id === 'technicians' ? (
                  <svg
                    viewBox={TECH_ICON_VIEWBOX}
                    width={iconSize}
                    height={Math.round((iconSize / TECH_ICON_ASPECT) * 100) / 100}
                    className={glowClass}
                    style={{
                      color: iconColor,
                      fill: 'currentColor',
                      stroke: 'none',
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
                    width={iconSize}
                    height={iconSize}
                    className={glowClass}
                    style={{
                      stroke: iconColor,
                      strokeWidth: isDashboard ? 2 : 1.75,
                      fill: 'none',
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                      transition: 'all 0.2s',
                    }}
                  >
                    {item.icon}
                  </svg>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
