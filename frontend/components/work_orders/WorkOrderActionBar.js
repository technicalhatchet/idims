import {
  LASER_BAR_HEIGHT_CSS,
  LaserBarStyles,
  LaserTag,
  usePressThenRun,
} from '../navigation/LaserBarParts';
import LaserFillBar from '../navigation/LaserFillBar';

/** Back | status-driven primary | + as even thirds (fractions of the width). */
const WO_DIVIDERS = [0.323, 0.677];

/**
 * Work order bottom bar: Back | status-driven primary | +.
 * (The resolver still returns a contextual `secondary`; the bar no longer shows it.)
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
  const primaryDisabled = busy || !primary || primary.tone === 'off';

  const slices = [
    {
      key: 'back',
      role: 'back',
      icon: 'back',
      label: 'Back',
      ariaLabel: 'Back',
      onPress: onBack,
    },
    {
      key: 'primary',
      role: 'primary',
      tone: primary?.tone || 'off',
      icon: primary?.icon || 'lock',
      label: primary ? (busy ? 'Saving…' : primary.label) : '',
      ariaLabel: primary ? (busy ? 'Saving…' : primary.label) : 'No action',
      contentKey: primary ? `${primary.id}-${primary.label}` : 'none',
      disabled: primaryDisabled,
      busy,
      pressed: pressedKey === 'primary',
      onPress: () => press('primary', () => onAction?.(primary.id, 'primary')),
    },
    {
      key: 'add',
      role: 'side',
      tone: 'cyan',
      icon: 'plus',
      label: 'Add',
      ariaLabel: 'Add to work order',
      disabled: addDisabled,
      onPress: onAdd,
    },
  ];

  return (
    <div
      className="lb-root md:hidden fixed inset-x-0 bottom-0 z-[1188]"
      style={{ height: LASER_BAR_HEIGHT_CSS, transform: 'translateZ(0)' }}
      data-touch-surface
    >
      <LaserBarStyles />
      <LaserTag text={tag?.text} tone={tag?.tone} />
      <nav aria-label="Work order actions" style={{ position: 'absolute', inset: 0 }}>
        <LaserFillBar idPrefix="wo-bar" slices={slices} dividers={WO_DIVIDERS} />
      </nav>
    </div>
  );
}
