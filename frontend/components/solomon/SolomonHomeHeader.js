'use client';

import { useCallback, useRef } from 'react';
import Link from 'next/link';
import { FaCog } from 'react-icons/fa';
import { toggleSolomonHeroDebug } from './solomonHeroDebug';

const LOGO_TAP_TARGET = 5;
const LOGO_TAP_WINDOW_MS = 2500;

export default function SolomonHomeHeader({ isStaff = false, className = '' }) {
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  const onLogoTap = useCallback(() => {
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    tapCountRef.current += 1;
    if (tapCountRef.current >= LOGO_TAP_TARGET) {
      tapCountRef.current = 0;
      toggleSolomonHeroDebug();
      return;
    }
    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
      tapTimerRef.current = null;
    }, LOGO_TAP_WINDOW_MS);
  }, []);

  return (
    <header className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0 flex-1 pt-0.5">
        <button
          type="button"
          onClick={onLogoTap}
          className="block max-w-full rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
          aria-label="Solomon Guided Diagnostics"
        >
          <img
            src="/solomon%20big.png"
            alt=""
            className="h-[35px] w-auto max-w-[min(100%,220px)] object-contain object-left drop-shadow-[0_0_12px_rgba(0,180,255,0.25)] pointer-events-none"
          />
        </button>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {isStaff ? (
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-cyan-300/90 hover:bg-white/5"
            aria-label="Settings"
          >
            <FaCog size={14} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
