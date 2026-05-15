import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Head from 'next/head';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';

/**
 * Must match the tactical page background (`bg-[size:42px_42px]` on mass / partswait / techboard / opsboard).
 * Inner HUD grids were 40px — that alone breaks alignment vs the 42px field grid.
 */
const GRID_STEP = 42;

/** One-pixel tweak after `getBoundingClientRect` alignment (DPR / border / hairlines). */
const GRID_NUDGE_X = -1;
const GRID_NUDGE_Y = -1;

const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

const PAGE_BG = '#0A0F1E';

function positiveMod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * `dx` / `dy` = titleplate top-left relative to the same box the full-page grid is painted in (padding edge
 * of the `relative` column). Shift the inner grid by `-positiveMod(dx, step)` so its 0,step,2·step… lines
 * coincide with the field grid at that location.
 */
function gridShiftForAlignment(dx, dy, step) {
  return {
    x: -positiveMod(dx, step),
    y: -positiveMod(dy, step),
  };
}

export default function HeaderTestPage() {
  const [showSpacer, setShowSpacer] = useState(false);
  const columnRef = useRef(null);
  const titleplateRef = useRef(null);
  const [gridShift, setGridShift] = useState({ x: 0, y: 0 });

  const syncGridAlignment = useCallback(() => {
    const col = columnRef.current;
    const plate = titleplateRef.current;
    if (!col || !plate) return;
    const c = col.getBoundingClientRect();
    const p = plate.getBoundingClientRect();
    const dx = p.left - c.left;
    const dy = p.top - c.top;
    const base = gridShiftForAlignment(dx, dy, GRID_STEP);
    setGridShift({ x: base.x + GRID_NUDGE_X, y: base.y + GRID_NUDGE_Y });
  }, []);

  useLayoutEffect(() => {
    syncGridAlignment();
    const col = columnRef.current;
    if (!col) return undefined;
    const ro = new ResizeObserver(() => {
      syncGridAlignment();
    });
    ro.observe(col);
    window.addEventListener('resize', syncGridAlignment);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncGridAlignment);
    };
  }, [syncGridAlignment, showSpacer]);

  return (
    <>
      <Head>
        <title>Header grid alignment test | IDIMS</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes headertest-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          @keyframes headertest-titleplate-scan {
            100% { left: 120%; }
          }
          .headertest-titleplate-grid {
            background-image:
              linear-gradient(rgba(255, 122, 0, 0.09) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 122, 0, 0.09) 1px, transparent 1px);
            background-size: ${GRID_STEP}px ${GRID_STEP}px;
            background-position: var(--hud-grid-x, 0px) var(--hud-grid-y, 0px);
          }
          .headertest-titleplate-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .headertest-titleplate-glow {
            text-shadow:
              0 0 8px rgba(255, 255, 255, 0.15),
              0 0 18px rgba(255, 122, 0, 0.14),
              0 0 40px rgba(251, 146, 60, 0.1);
          }
          .headertest-titleplate-edge {
            position: relative;
          }
          .headertest-titleplate-edge::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(
              135deg,
              rgba(251, 146, 60, 0.55),
              rgba(180, 83, 9, 0.22),
              rgba(255, 122, 0, 0.42)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
          }
          .headertest-titleplate-scan::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.06),
              transparent
            );
            animation: headertest-titleplate-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0d1525 !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
          }
        `}</style>
      </Head>

      <div className="min-h-screen" style={{ background: PAGE_BG }}>
        <div ref={columnRef} className="relative px-4 py-6 max-w-lg mx-auto">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: PAGE_BG }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
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
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.52)_100%)] pointer-events-none" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-[42%]"
                style={{
                  left: '-48%',
                  background:
                    'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: 'headertest-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#080C14]/90 px-3 py-2 text-xs text-gray-400">
              <span>
                Orange titleplate grid uses the same {GRID_STEP}px step as the cyan field. Offset (px):{' '}
                <code className="text-orange-300/90">
                  {gridShift.x.toFixed(0)}, {gridShift.y.toFixed(0)}
                </code>
              </span>
              <button
                type="button"
                onClick={() => setShowSpacer((v) => !v)}
                className="rounded border border-orange-400/40 px-2 py-1 text-[11px] text-orange-300 hover:bg-orange-500/10"
              >
                {showSpacer ? 'Remove' : 'Add'} block above header
              </button>
            </div>

            {showSpacer && (
              <div
                className="rounded-lg border border-dashed border-white/15 py-10 text-center text-xs text-gray-500"
                style={{ minHeight: '88px' }}
              >
                Simulated content (changes vertical phase — grid should stay aligned)
              </div>
            )}

            <div
              ref={titleplateRef}
              className="headertest-titleplate-edge headertest-titleplate-scan relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-orange-400/35 bg-[rgba(5,12,22,.84)] px-3.5 py-3 shadow-[0_0_30px_rgba(255,122,0,.32)] backdrop-blur-2xl md:px-5 md:py-4"
              style={
                {
                  '--hud-grid-x': `${gridShift.x}px`,
                  '--hud-grid-y': `${gridShift.y}px`,
                }
              }
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 headertest-titleplate-grid"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-orange-400/20 to-orange-600/0 opacity-60" />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="pointer-events-none absolute inset-x-4 bottom-0 z-[1] h-px bg-gradient-to-r from-transparent via-orange-400/25 to-transparent md:inset-x-8" />

              <div className="relative z-[2] min-w-0">
                <p className="headertest-titleplate-orbitron mb-1.5 text-[8px] font-semibold uppercase leading-tight tracking-[0.2em] text-orange-300/95 md:text-[9px] md:tracking-[0.28em]">
                  Alignment prototype
                </p>
                <h1 className="headertest-titleplate-orbitron headertest-titleplate-glow text-[1.0625rem] font-black uppercase leading-none tracking-[0.06em] text-white sm:text-xl sm:tracking-[0.1em] md:text-2xl md:tracking-[0.14em]">
                  Header grid test
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-2.5">
                  <div className="h-px w-10 shrink-0 bg-gradient-to-r from-orange-300 to-transparent md:w-16" />
                  <span className="headertest-titleplate-orbitron text-[9px] uppercase tracking-[0.12em] text-white/45 md:text-[10px] md:tracking-[0.2em]">
                    /work_orders/headertest
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-gray-500">
              Measurements use <code className="text-gray-400">columnRef</code> (the same <code className="text-gray-400">relative px-4 py-6</code>{' '}
              box the full-page grid is <code className="text-gray-400">inset-0</code> into) and{' '}
              <code className="text-gray-400">titleplateRef</code>. The inner grid&apos;s{' '}
              <code className="text-gray-400">background-position</code> is set to{' '}
              <code className="text-gray-400">-(dx % 42), -(dy % 42)</code> so orange lines register with cyan
              field lines where they overlap.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

HeaderTestPage.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;
