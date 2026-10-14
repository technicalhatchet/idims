/**
 * ApplianceIcon (client portal) — Atomic neon SVG set.
 * Usage: <ApplianceIcon type="refrigerator" className="w-8 h-8" />
 * Small set below 56px, detail set at 56px (w-14) and up.
 */
import AtomicIcon, { tierForClassName } from '../ui/AtomicIcon';

// eslint-disable-next-line no-unused-vars -- `color` kept for backwards compatibility; the icon set carries its own colors
export default function ApplianceIcon({ type, className = 'w-8 h-8', color }) {
  return <AtomicIcon equipmentType={type} tier={tierForClassName(className)} className={className} />;
}
