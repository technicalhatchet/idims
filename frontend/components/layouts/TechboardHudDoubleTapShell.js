import { useHudGridDoubleTapRail } from '../../hooks/useHudGridDoubleTapRail';

const PAGE_BG = '#0A0F1E';
const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

/**
 * Tactical grid + double-tap-to-open-rail layer (see TechDashboardLayout .hud-grid-content).
 */
export default function TechboardHudDoubleTapShell({
  children,
  contentClassName = 'px-4 py-6 max-w-3xl mx-auto pb-24',
  columnClassName = 'max-w-3xl mx-auto',
}) {
  const gridTapLayerRef = useHudGridDoubleTapRail();

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG }}>
      <div className={`hud-tactical-column relative min-h-screen ${columnClassName}`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-0" style={{ background: PAGE_BG }} />
          <div
            className="absolute inset-0 opacity-[0.11]
              bg-[linear-gradient(rgba(0,217,255,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
              bg-[size:42px_42px]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,.13),transparent_48%)]" />
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
            style={{ backgroundImage: TACTICAL_NOISE_BG }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.52)_100%)] pointer-events-none" />
        </div>

        <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden />

        <div className={`hud-grid-content relative z-10 ${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
}
