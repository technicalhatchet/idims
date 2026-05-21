import { useCallback, useLayoutEffect, useRef } from 'react';
import Head from 'next/head';
import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';
import { TX_ORANGE } from '../../constants/technicianMobileTheme';

const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

export const TX_MOBILE_PAGE_BG = '#0A0F1E';
const HUD_GRID_STEP = 42;
const HUD_GRID_NUDGE_X = -1;
const HUD_GRID_NUDGE_Y = -1;

function positiveMod(n, m) {
  return ((n % m) + m) % m;
}

function hudGridShiftForTitleplate(dx, dy, step) {
  return {
    x: -positiveMod(dx, step),
    y: -positiveMod(dy, step),
  };
}

export default function TechnicianMobileShell({ title, scanKey = 'tx-mobile', titleplate, children, syncKey }) {
  const gridTapLayerRef = useHudGridDoubleTapRail();
  const tacticalColumnRef = useRef(null);
  const titleplateRef = useRef(null);
  const hudGridShiftRef = useRef({ x: 0, y: 0 });

  const syncHudGridAlignment = useCallback(() => {
    const col = tacticalColumnRef.current;
    const plate = titleplateRef.current;
    if (!col || !plate) return;
    const c = col.getBoundingClientRect();
    const p = plate.getBoundingClientRect();
    const dx = p.left - c.left;
    const dy = p.top - c.top;
    const base = hudGridShiftForTitleplate(dx, dy, HUD_GRID_STEP);
    const shift = { x: base.x + HUD_GRID_NUDGE_X, y: base.y + HUD_GRID_NUDGE_Y };
    hudGridShiftRef.current = shift;
    plate.style.setProperty(`--${scanKey}-hud-grid-x`, `${shift.x}px`);
    plate.style.setProperty(`--${scanKey}-hud-grid-y`, `${shift.y}px`);
  }, [scanKey]);

  useLayoutEffect(() => {
    syncHudGridAlignment();
    const col = tacticalColumnRef.current;
    if (!col) return undefined;
    const ro = new ResizeObserver(() => syncHudGridAlignment());
    ro.observe(col);
    window.addEventListener('resize', syncHudGridAlignment);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncHudGridAlignment);
    };
  }, [syncHudGridAlignment, syncKey]);

  return (
    <>
      <Head>
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes ${scanKey}-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          .${scanKey}-hud-titleplate-grid {
            background-image:
              linear-gradient(${TX_ORANGE.grid} 1px, transparent 1px),
              linear-gradient(90deg, ${TX_ORANGE.grid} 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--${scanKey}-hud-grid-x, 0px) var(--${scanKey}-hud-grid-y, 0px);
          }
          .${scanKey}-hud-orbitron { font-family: 'Orbitron', system-ui, sans-serif; }
          .${scanKey}-neon-edge { position: relative; }
          .${scanKey}-neon-edge::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(135deg, rgba(255, 122, 0, 0.72), rgba(68, 28, 8, 0.28), rgba(255, 154, 60, 0.5));
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
          }
          .${scanKey}-hud-scan::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, ${TX_ORANGE.scan}, transparent);
            animation: ${scanKey}-hud-card-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          @keyframes ${scanKey}-hud-card-scan { 100% { left: 120%; } }
        `}</style>
      </Head>

      <div className="min-h-screen pb-24" style={{ background: TX_MOBILE_PAGE_BG }}>
        <div ref={tacticalColumnRef} className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto min-h-screen">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: TX_MOBILE_PAGE_BG }} />
            <div
              className="absolute inset-0 opacity-[0.11] bg-[size:42px_42px]"
              style={{
                backgroundImage: `linear-gradient(${TX_ORANGE.gridLine.replace('0.28', '0.36')} 1px, transparent 1px), linear-gradient(90deg, ${TX_ORANGE.gridLine} 1px, transparent 1px)`,
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,0,.13),transparent_48%)]" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[min(560px,120%)] h-[220px] bg-orange-400/[0.085] blur-[120px] rounded-full" />
            <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: TACTICAL_NOISE_BG }} />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-[42%]"
                style={{
                  left: '-48%',
                  background: 'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255, 154, 60, 0.04) 50%, transparent 68%, transparent 100%)',
                  animation: `${scanKey}-tactical-scan 6.5s linear infinite`,
                }}
              />
            </div>
          </div>

          <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden="true" />

          <div className="hud-grid-content relative z-10 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="mb-5">
              <div
                ref={titleplateRef}
                data-hud-card
                className={`relative overflow-hidden rounded-[18px] border border-orange-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 shadow-[0_0_30px_rgba(255,122,0,.28)] ${scanKey}-neon-edge ${scanKey}-hud-scan`}
              >
                <div className={`pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 ${scanKey}-hud-titleplate-grid`} aria-hidden />
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-orange-950/0 opacity-60 pointer-events-none rounded-[inherit]" />
                <div className="relative z-[2]">{titleplate}</div>
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
