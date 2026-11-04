import { useEffect, useRef } from 'react';
import { useTechDashboardRail } from '../components/layouts/TechDashboardLayout';
import { attachRailDoubleTap } from '../utils/railDoubleTap';

/**
 * Double-tap empty tactical grid background to open the tech dashboard icon rail.
 * Swipes and taps on controls never count, and scrolling is never blocked.
 */
export function useHudGridDoubleTapRail() {
  const railContext = useTechDashboardRail();
  const openRail = railContext?.openRail;
  const gridTapLayerRef = useRef(null);

  useEffect(() => {
    const layer = gridTapLayerRef.current;
    if (!layer || !openRail) return undefined;
    return attachRailDoubleTap(layer, openRail);
  }, [openRail]);

  return gridTapLayerRef;
}
