'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const THRESHOLD = 68;
const MAX_PULL = 112;
const DAMP = 0.42;

function scrollTopDoc() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/**
 * Window-level pull-down gesture when the page is scrolled to the top.
 * Intended for installed PWAs / mobile Safari where overscroll refresh is common.
 */
export default function PullToRefresh({ onRefresh, disabled = false, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const armedRef = useRef(false);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    setPull(0);
    pullRef.current = 0;
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    const onTouchStart = (e) => {
      if (disabled || refreshing) return;
      if (scrollTopDoc() > 2) return;
      armedRef.current = true;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (!armedRef.current || disabled || refreshing) return;
      if (scrollTopDoc() > 2) {
        armedRef.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const p = Math.min(dy * DAMP, MAX_PULL);
      pullRef.current = p;
      setPull(p);
      if (p > 0 && e.cancelable) e.preventDefault();
    };

    const endGesture = () => {
      if (!armedRef.current || disabled) {
        armedRef.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      armedRef.current = false;
      const p = pullRef.current;
      pullRef.current = 0;
      setPull(0);
      if (!refreshing && p >= THRESHOLD) {
        void runRefresh();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', endGesture, { passive: true });
    window.addEventListener('touchcancel', endGesture, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endGesture);
      window.removeEventListener('touchcancel', endGesture);
    };
  }, [disabled, refreshing, runRefresh]);

  const showRail = pull > 3 || refreshing;
  const ready = pull >= THRESHOLD && !refreshing;

  return (
    <div className="relative">
      <div
        className="fixed left-0 right-0 z-[45] flex justify-center pointer-events-none px-4"
        style={{
          top: 0,
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${refreshing ? 14 : Math.max(8, Math.min(pull * 0.35, 40))}px)`,
          minHeight: showRail ? 44 : 0,
          opacity: showRail ? 1 : 0,
          transition: refreshing ? 'opacity 0.15s ease' : 'opacity 0.12s ease',
        }}
        aria-live="polite"
      >
        {showRail ? (
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: 'linear-gradient(180deg, rgba(10,24,40,0.72), rgba(5,14,28,0.78))',
              border: '1px solid rgba(34,211,238,0.22)',
              boxShadow: '0 0 20px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {refreshing ? (
              <>
                <div
                  className="h-4 w-4 shrink-0 rounded-full border-2 border-cyan-400/25 border-t-cyan-300 animate-spin"
                  aria-hidden
                />
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: 'rgba(126,238,248,0.95)' }}
                >
                  Syncing
                </span>
              </>
            ) : (
              <>
                <span
                  aria-hidden
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-cyan-300"
                  style={{
                    transform: `rotate(${Math.min(180, pull * 2.4)}deg)`,
                    transition: 'transform 0.05s linear',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <polyline
                      points="6 9 12 15 18 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: ready ? 'rgba(190,248,255,0.98)' : 'rgba(126,238,248,0.75)' }}
                >
                  {ready ? 'Release' : 'Pull to refresh'}
                </span>
              </>
            )}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
