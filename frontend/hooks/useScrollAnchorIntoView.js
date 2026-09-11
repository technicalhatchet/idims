'use client';

import { useEffect, useRef } from 'react';
import { scrollAnchorIntoView } from '../utils/scrollAnchorIntoView';

/**
 * Attach ref to a scroll anchor; re-scroll when watchKey changes (wizard/procedure step id).
 */
export function useScrollAnchorIntoView(watchKey, options = {}) {
  const ref = useRef(null);
  const { enabled = true, delayMs = 100, block = 'start' } = options;

  useEffect(() => {
    if (!enabled || watchKey == null) return undefined;
    const timer = window.setTimeout(() => {
      scrollAnchorIntoView(ref.current, { block });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [watchKey, enabled, delayMs, block]);

  return ref;
}
