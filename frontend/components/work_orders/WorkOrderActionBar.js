import {
  LASER_BAR_HEIGHT_CSS,
  LaserBarStyles,
  LaserTag,
  usePressThenRun,
} from '../navigation/LaserBarParts';
import LaserFillBar from '../navigation/LaserFillBar';

/** Back | status-driven primary | contextual secondary | + (fractions of the width). */
const WO_DIVIDERS = [0.23, 0.665, 0.835];

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
      key: 'secondary',
      role: 'side',
      tone: 'cyan',
      icon: secondary?.icon || 'plus',
      showLabel: false,
      label: secondary?.label || 'More',
      ariaLabel: secondary?.label || 'More',
      disabled: !secondary,
      style: secondary ? undefined : { visibility: 'hidden' },
      onPress: () => secondary && onAction?.(secondary.id, 'secondary'),
    },
    {
      key: 'add',
      role: 'side',
      tone: 'cyan',
      icon: 'plus',
      showLabel: false,
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
