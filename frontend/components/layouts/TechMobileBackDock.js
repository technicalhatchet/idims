import LaserNavDock from '../navigation/LaserNavDock';
import { useClaimBottomDock } from './bottomDock';

/**
 * Standard mobile bottom bar for a TechDeck page that wants extra actions
 * (e.g. Back | New WO | Call). Pages without one get a Back-only bar automatically
 * from TechDashboardLayout, so this is only needed to add actions.
 *
 * primary / secondary: { label, icon, tone?, href?, onPress?, disabled? }
 */
export default function TechMobileBackDock({ fallbackHref = '/techboard', primary = null, secondary = null }) {
  useClaimBottomDock('standard');
  return <LaserNavDock fallbackHref={fallbackHref} primary={primary} secondary={secondary} idPrefix="page-dock" />;
}

/**
 * Kept for existing imports. TechDashboardLayout now reserves the bar's space itself,
 * so pages no longer need extra bottom padding.
 */
export const TECH_MOBILE_BACK_DOCK_SCROLL_PAD = '';
