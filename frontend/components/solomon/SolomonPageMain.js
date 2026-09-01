import { useSolomonTopInset, solomonSafeBottom } from './solomonSafeArea';
import useSolomonBottomNavVisible from '../../hooks/useSolomonBottomNavVisible';
import SolomonBottomNav from './SolomonBottomNav';
import { SOLOMON_BOTTOM_NAV_HEIGHT_PX } from './solomonNavigation';

/** Standard Solomon scroll page with notch + sync banner top inset. */
export default function SolomonPageMain({ children, className = '' }) {
  const topInset = useSolomonTopInset();
  const showBottomNav = useSolomonBottomNavVisible();
  const paddingBottom = showBottomNav
    ? `calc(${SOLOMON_BOTTOM_NAV_HEIGHT_PX}px + 1.25rem + env(safe-area-inset-bottom, 0px))`
    : 'max(6rem, env(safe-area-inset-bottom, 0px))';

  return (
    <>
      <main
        className={`min-h-screen bg-[var(--solomon-bg-shell)] text-white px-5 max-w-lg mx-auto ${className}`}
        style={{ ...topInset, ...solomonSafeBottom, paddingBottom }}
      >
        {children}
      </main>
      {showBottomNav ? <SolomonBottomNav /> : null}
    </>
  );
}
