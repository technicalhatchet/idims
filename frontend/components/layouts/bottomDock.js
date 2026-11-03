import { createContext, useContext, useEffect, useLayoutEffect } from 'react';

/**
 * Lets a page tell TechDashboardLayout "I'm drawing my own bottom bar".
 *  - 'custom'   : page draws its own bar AND handles its own bottom spacing
 *                 (work order page, Techboard dock, work order form).
 *  - 'standard' : page uses <TechMobileBackDock> with extra actions; the layout
 *                 still reserves the bar's space.
 * With no claim, the layout shows a Back-only laser bar.
 */
export const BottomDockContext = createContext(null);

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useClaimBottomDock(kind = 'custom', enabled = true) {
  const ctx = useContext(BottomDockContext);
  useIsoLayoutEffect(() => {
    if (!ctx || !enabled) return undefined;
    ctx.claim(kind);
    return () => ctx.release(kind);
  }, [ctx, kind, enabled]);
}
