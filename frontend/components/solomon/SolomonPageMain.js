import { useSolomonTopInset } from './solomonSafeArea';
import useSolomonBottomNavVisible from '../../hooks/useSolomonBottomNavVisible';
import SolomonBottomNav from './SolomonBottomNav';
import { solomonBottomNavScrollPadding, solomonFooterScrollPadding } from './solomonSafeArea';

/** Standard Solomon scroll page with notch + sync banner top inset. */
export default function SolomonPageMain({ children, className = '' }) {
  const topInset = useSolomonTopInset();
  const showBottomNav = useSolomonBottomNavVisible();
  const paddingBottom = showBottomNav
    ? solomonBottomNavScrollPadding(1.25)
    : solomonFooterScrollPadding(6);

  return (
    <>
      <main
        className={`min-h-screen min-w-0 overflow-x-hidden bg-[var(--solomon-bg-shell)] text-white px-5 max-w-lg mx-auto ${className}`}
        style={{ ...topInset, paddingBottom }}
      >
        {children}
      </main>
      {showBottomNav ? <SolomonBottomNav /> : null}
    </>
  );
}
