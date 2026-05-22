import { useCallback, useLayoutEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';

const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

export const WO_MOBILE_PAGE_BG = '#0A0F1E';
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

export default function WorkOrderMobileShell({
  title,
  pageTitle,
  backHref,
  subtitle,
  scanKey = 'wo-form-mobile',
  syncKey,
  children,
}) {
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
        <title>{pageTitle || title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style>{`
          @keyframes ${scanKey}-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          .${scanKey}-hud-titleplate-grid {
            background-image:
              linear-gradient(rgba(0,217,255,.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,217,255,.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--${scanKey}-hud-grid-x, 0px) var(--${scanKey}-hud-grid-y, 0px);
          }
          .wo-mobile-form label {
            color: rgb(156 163 175);
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .wo-mobile-form .form-input,
          .wo-mobile-form select,
          .wo-mobile-form textarea {
            background: rgba(0, 0, 0, 0.3) !important;
            border-color: rgba(34, 211, 238, 0.2) !important;
            color: #fff !important;
          }
          .wo-mobile-form .form-input:focus,
          .wo-mobile-form select:focus,
          .wo-mobile-form textarea:focus {
            border-color: rgba(34, 211, 238, 0.5) !important;
            box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.35);
          }
          .wo-mobile-form h3 {
            color: rgb(34 211 238);
            font-size: 0.875rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
        `}</style>
      </Head>

      <div className="min-h-screen pb-28" style={{ background: WO_MOBILE_PAGE_BG }}>
        <div ref={tacticalColumnRef} className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto min-h-screen">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: WO_MOBILE_PAGE_BG }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.36)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
                bg-[size:42px_42px]"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,.13),transparent_48%)]" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[min(560px,120%)] h-[220px] bg-cyan-400/[0.085] blur-[120px] rounded-full" />
            <div
              className="absolute inset-0 opacity-[0.028]
                bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,.1),rgba(255,255,255,.1)_1px,transparent_1px,transparent_14px)]"
            />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
              style={{ backgroundImage: TACTICAL_NOISE_BG }}
            />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-[42%]"
                style={{
                  left: '-48%',
                  background: 'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: `${scanKey}-tactical-scan 6.5s linear infinite`,
                }}
              />
            </div>
          </div>

          <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden="true" />

          <div className="hud-grid-content relative z-10 p-4 sm:p-6">
            <div className="mb-4">
              <div
                ref={titleplateRef}
                data-hud-card
                className="relative overflow-hidden rounded-[18px] border border-cyan-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 shadow-[0_0_30px_rgba(0,212,255,.28)]"
              >
                <div className={`pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 ${scanKey}-hud-titleplate-grid`} aria-hidden />
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-cyan-950/0 opacity-60 pointer-events-none rounded-[inherit]" />
                <div className="relative z-[2] flex items-start gap-3">
                  {backHref && (
                    <Link
                      href={backHref}
                      className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-[#0D1525] text-cyan-400 active:bg-white/5"
                      aria-label="Go back"
                    >
                      <FaArrowLeft className="h-4 w-4" />
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/95">
                      Work order
                    </p>
                    <h1 className="text-lg font-bold text-white truncate">{title}</h1>
                    {subtitle && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-lg p-3 overflow-visible"
              style={{
                background: 'rgba(13, 21, 37, 0.25)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              data-hud-card
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
