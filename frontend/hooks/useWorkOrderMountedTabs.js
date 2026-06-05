import { useCallback, useState } from 'react';

/** Track which WO detail tabs have been opened so they stay mounted (hidden) after first visit. */
export function useWorkOrderMountedTabs(initialTab) {
  const [mountedTabs, setMountedTabs] = useState(() => new Set([initialTab]));

  const markTabMounted = useCallback((tabId) => {
    setMountedTabs((prev) => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
  }, []);

  const isTabMounted = useCallback((tabId) => mountedTabs.has(tabId), [mountedTabs]);

  return { isTabMounted, markTabMounted };
}
