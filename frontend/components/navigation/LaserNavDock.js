import { useRouter } from 'next/router';
import {
  LASER_BAR_HEIGHT_CSS,
  LaserBarStyles,
  usePressThenRun,
} from './LaserBarParts';
import LaserFillBar from './LaserFillBar';

/**
 * The standard TechDeck mobile bottom bar (laser fin), for pages without a custom bar.
 *   Back only:            [ ← BACK ]
 *   With a main action:   [ BACK / PRIMARY / secondary? ] as slices filling the fin
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

  const slices = [
    { key: 'back', role: 'back', icon: 'back', label: 'Back', ariaLabel: 'Back', onPress: goBack },
  ];
  if (primary) {
    slices.push({
      key: 'primary',
      role: 'primary',
      tone: primary.disabled ? 'off' : primary.tone || 'cyan',
      icon: primary.icon || 'plus',
      label: primary.label,
      disabled: primary.disabled,
      pressed: pressedKey === 'primary',
      onPress: () => press('primary', () => run(primary)),
    });
    if (secondary) {
      slices.push({
        key: 'secondary',
        role: 'side',
        tone: 'cyan',
        icon: secondary.icon,
        label: secondary.label,
        disabled: secondary.disabled,
        onPress: () => run(secondary),
      });
    }
  }
  // Even thirds with a third button, like the work order and Techboard bars.
  const dividers = !primary ? [] : secondary ? [0.323, 0.677] : [0.27];

  return (
    <div
      className="lb-root md:hidden fixed inset-x-0 bottom-0 z-[1188]"
      style={{ height: LASER_BAR_HEIGHT_CSS, transform: 'translateZ(0)' }}
      data-touch-surface
    >
      <LaserBarStyles />
      <nav aria-label="Page actions" style={{ position: 'absolute', inset: 0 }}>
        <LaserFillBar idPrefix={idPrefix} slices={slices} dividers={dividers} />
      </nav>
    </div>
  );
}
