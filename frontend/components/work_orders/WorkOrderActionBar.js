import {
  LASER_BAR_HEIGHT,
  LaserBarStyles,
  LaserFin,
  LaserIcon,
  LaserSeam,
  LaserTag,
  laserTileStyle,
  usePressThenRun,
} from '../navigation/LaserBarParts';

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
 * Work order bottom bar: Back | status-driven primary | contextual secondary | +.
 * `bar` comes from utils/workOrderActionBar.resolveWorkOrderActionBar.
 */
export default function WorkOrderActionBar({
  bar,
  busy = false,
  addDisabled = false,
  tag = null,
  onBack,
  onAdd,
  onAction,
}) {
  const [pressedKey, press] = usePressThenRun(300);
  const primary = bar?.primary;
  const secondary = bar?.secondary;
  const primaryDisabled = busy || !primary || primary.tone === 'off';
  const primaryPressed = pressedKey === 'primary';

  return (
    <div
      className="lb-root md:hidden fixed inset-x-0 bottom-0 z-[1188]"
      style={{ height: `calc(${LASER_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`, transform: 'translateZ(0)' }}
      data-touch-surface
    >
      <LaserBarStyles />
      <LaserTag text={tag?.text} tone={tag?.tone} />
      <nav aria-label="Work order actions" style={{ position: 'absolute', inset: 0 }}>
        <LaserFin idPrefix="wo-bar" />
        <div
          style={{
            position: 'absolute',
            top: 32,
            left: 'max(12px, 11%)',
            right: 'max(12px, 11%)',
            height: 44,
            display: 'grid',
            gridTemplateColumns: '44px minmax(0, 1fr) 44px 44px',
            gap: 8,
          }}
        >
          <button
            type="button"
            className="lb-tile"
            onClick={onBack}
            aria-label="Back"
            style={{ ...ICON_TILE, border: '1px solid rgba(255, 255, 255, 0.16)', color: '#B8C7D6' }}
          >
            <LaserIcon name="back" strokeWidth={2} />
          </button>

          <button
            type="button"
            className="lb-tile"
            disabled={primaryDisabled}
            aria-busy={busy || undefined}
            onClick={() => press('primary', () => onAction?.(primary.id, 'primary'))}
            style={{
              position: 'relative',
              overflow: 'hidden',
              height: 44,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              touchAction: 'manipulation',
              cursor: primaryDisabled ? 'default' : 'pointer',
              opacity: busy ? 0.75 : 1,
              transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s, background 0.3s, color 0.25s, opacity 0.2s',
              ...laserTileStyle(primary?.tone, { pressed: primaryPressed }),
            }}
          >
            {primary ? (
              <span key={`${primary.id}-${primary.label}`} className="lb-pop" style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                <LaserIcon name={primary.icon} size={16} strokeWidth={2.1} />
                {busy ? 'Saving…' : primary.label}
              </span>
            ) : null}
            {primaryPressed ? <LaserSeam tone={primary?.tone} /> : null}
          </button>

          <button
            type="button"
            className="lb-tile"
            aria-label={secondary?.label || 'More'}
            disabled={!secondary}
            onClick={() => secondary && onAction?.(secondary.id, 'secondary')}
            style={ICON_TILE}
          >
            {secondary ? <LaserIcon name={secondary.icon} /> : null}
          </button>

          <button
            type="button"
            className="lb-tile"
            aria-label="Add to work order"
            disabled={addDisabled}
            onClick={onAdd}
            style={{ ...ICON_TILE, opacity: addDisabled ? 0.45 : 1 }}
          >
            <LaserIcon name="plus" strokeWidth={2.2} />
          </button>
        </div>
      </nav>
    </div>
  );
}
