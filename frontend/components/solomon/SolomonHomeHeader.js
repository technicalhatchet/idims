'use client';

import { useCallback, useRef } from 'react';
import Link from 'next/link';
import { FaCog } from 'react-icons/fa';
import useSolomonTheme from '../../hooks/useSolomonTheme';
import { toggleSolomonHeroDebug } from './solomonHeroDebug';

const LOGO_TAP_TARGET = 5;
const LOGO_TAP_WINDOW_MS = 2500;

export default function SolomonHomeHeader({ className = '' }) {
  const { isProfessional } = useSolomonTheme();
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
    <header
      className={`flex items-center justify-between gap-3 ${
        isProfessional
          ? 'border-b border-[color:var(--solomon-border-muted)] pb-3'
          : ''
      } ${className}`}
    >
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onLogoTap}
          className={`block max-w-full rounded-md focus:outline-none ${
            isProfessional
              ? 'solomon-focus-ring'
              : 'focus-visible:ring-2 focus-visible:ring-cyan-400/50'
          }`}
          aria-label="Solomon Guided Diagnostics"
        >
          <img
            src="/solomon%20big.png"
            alt=""
            className={`w-auto object-contain object-left pointer-events-none ${
              isProfessional
                ? 'h-[44px] max-w-[min(100%,260px)]'
                : 'h-[35px] max-w-[min(100%,220px)] drop-shadow-[0_0_12px_rgba(0,180,255,0.25)]'
            }`}
          />
        </button>
        {isProfessional ? (
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--solomon-text-muted)]">
            Guided diagnostics
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-0.5 shrink-0 self-start">
        <Link
          href="/solomon/settings"
          className={`solomon-focus-ring flex items-center justify-center rounded-[var(--solomon-radius-control)] border transition-colors ${
            isProfessional
              ? 'h-9 w-9 border-[color:var(--solomon-border-subtle)] text-[var(--solomon-text-secondary)] hover:bg-[var(--solomon-surface-elevated)]'
              : 'h-8 w-8 rounded-full border-white/15 text-cyan-300/90 hover:bg-white/5'
          }`}
          aria-label="Solomon settings"
        >
          <FaCog size={isProfessional ? 15 : 14} />
        </Link>
      </div>
    </header>
  );
}
