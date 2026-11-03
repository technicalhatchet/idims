import { useRouter } from 'next/router';
import {
  LASER_BAR_BUTTON_TOP,
  LASER_BAR_HEIGHT_CSS,
  LaserBarStyles,
  LaserFin,
  LaserIcon,
  LaserSeam,
  laserTileStyle,
  usePressThenRun,
} from './LaserBarParts';

const ICON_TILE = {
  height: 44,
  borderRadius: 12,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid rgba(34, 211, 238, 0.4)',
  background: 'rgba(13, 22, 38, 0.9)',
  color: '#8FE6F3',
  touchAction: 'manipulation',
};

/**
 * The standard TechDeck mobile bottom bar (laser fin), for pages without a custom bar.
 *   Back only:            [ ← BACK ]
 *   With a main action:   [←] [ PRIMARY ] [secondary?]
 *
 * primary / secondary: { label, icon, tone?, href?, onPress?, disabled? }
 */
export default function LaserNavDock({ fallbackHref = '/techboard', primary = null, secondary = null, idPrefix = 'nav-dock' }) {
  const router = useRouter();
  const [pressedKey, press] = usePressThenRun(260);

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  const run = (action) => {
    if (!action || action.disabled) return;
    if (action.href) router.push(action.href);
    else action.onPress?.();
  };

  const backOnly = !primary;
  const columns = backOnly ? 'minmax(0, 1fr)' : secondary ? '44px minmax(0, 1fr) 44px' : '44px minmax(0, 1fr)';

  return (
    <div
      className="lb-root md:hidden fixed inset-x-0 bottom-0 z-[1188]"
      style={{ height: LASER_BAR_HEIGHT_CSS, transform: 'translateZ(0)' }}
      data-touch-surface
    >
      <LaserBarStyles />
      <nav aria-label="Page actions" style={{ position: 'absolute', inset: 0 }}>
        <LaserFin idPrefix={idPrefix} />
        <div
          style={{
            position: 'absolute',
            top: LASER_BAR_BUTTON_TOP,
            left: 'max(12px, 11%)',
            right: 'max(12px, 11%)',
            height: 44,
            display: 'grid',
            gridTemplateColumns: columns,
            gap: 8,
            justifyItems: backOnly ? 'center' : 'stretch',
          }}
        >
          <button
            type="button"
            className="lb-tile"
            onClick={goBack}
            aria-label="Back"
            style={{
              ...ICON_TILE,
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#B8C7D6',
              ...(backOnly
                ? { width: 'min(100%, 220px)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }
                : {}),
            }}
          >
            <LaserIcon name="back" strokeWidth={2} />
            {backOnly ? 'BACK' : null}
          </button>

          {primary ? (
            <button
              type="button"
              className="lb-tile"
              disabled={primary.disabled}
              onClick={() => press('primary', () => run(primary))}
              style={{
                position: 'relative',
                overflow: 'hidden',
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                touchAction: 'manipulation',
                transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s',
                ...laserTileStyle(primary.disabled ? 'off' : primary.tone || 'cyan', { pressed: pressedKey === 'primary' }),
              }}
            >
              <LaserIcon name={primary.icon || 'plus'} size={16} strokeWidth={2.1} />
              {primary.label}
              {pressedKey === 'primary' ? <LaserSeam tone={primary.tone || 'cyan'} /> : null}
            </button>
          ) : null}

          {primary && secondary ? (
            <button
              type="button"
              className="lb-tile"
              aria-label={secondary.label}
              disabled={secondary.disabled}
              onClick={() => run(secondary)}
              style={{ ...ICON_TILE, opacity: secondary.disabled ? 0.45 : 1 }}
            >
              <LaserIcon name={secondary.icon} />
            </button>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
