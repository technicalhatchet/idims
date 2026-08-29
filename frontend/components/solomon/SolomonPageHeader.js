'use client';

import Link from 'next/link';
import { FaChevronLeft } from 'react-icons/fa';

export const SOLOMON_LOGO_SRC = '/solomon%20big.png';
export const SOLOMON_HAT_SRC = '/images/solomonwiz/hatmaster.png';

const tapTarget = 'flex items-center justify-center min-h-[44px] min-w-[44px]';

/** Hat + left arrow — back to Solomon home (or custom href). */
export function SolomonHatBackButton({ href = '/solomon', className = '' }) {
  return (
    <Link
      href={href}
      aria-label="Back to Solomon"
      className={`${tapTarget} -ml-2 group ${className}`}
    >
      <span className="inline-flex items-center gap-0 rounded-full border border-white/12 bg-white/[0.04] pl-1.5 pr-2 py-1 shadow-[0_0_16px_rgba(0,180,255,0.08)] transition-colors group-hover:border-cyan-400/30 group-hover:bg-white/[0.07]">
        <FaChevronLeft size={12} className="text-cyan-400/90 shrink-0 -mr-0.5" aria-hidden />
        <img
          src={SOLOMON_HAT_SRC}
          alt=""
          className="h-7 w-7 object-contain drop-shadow-[0_0_8px_rgba(0,180,255,0.2)] pointer-events-none"
          decoding="async"
        />
      </span>
    </Link>
  );
}

/** Arrow-only back — parent list pages (e.g. My Diagnostics). */
export function SolomonArrowBack({ href, label = 'Back', className = '' }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${tapTarget} -ml-2 text-cyan-400/90 hover:text-cyan-300 transition-colors ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] hover:border-cyan-400/25 hover:bg-white/[0.06]">
        <FaChevronLeft size={14} aria-hidden />
      </span>
    </Link>
  );
}

export function SolomonCenteredLogo({ className = '' }) {
  return (
    <img
      src={SOLOMON_LOGO_SRC}
      alt=""
      className={`h-8 w-auto max-w-[min(100%,200px)] object-contain object-center drop-shadow-[0_0_12px_rgba(0,180,255,0.2)] sm:h-9 ${className}`}
      decoding="async"
    />
  );
}

/**
 * Uniform Solomon sub-page header — centered logo, left back control, optional right slot.
 * Safe area is applied by SolomonPageMain / SolomonMobileShell, not here.
 *
 * back: 'hat' | 'arrow' | ReactNode
 */
export default function SolomonPageHeader({
  back = 'hat',
  backHref = '/solomon',
  backLabel = 'Back',
  right = null,
  className = '',
}) {
  let left = null;
  if (back === 'hat') {
    left = <SolomonHatBackButton href={backHref} />;
  } else if (back === 'arrow') {
    left = <SolomonArrowBack href={backHref} label={backLabel} />;
  } else {
    left = back;
  }

  return (
    <header className={`relative mb-4 ${className}`}>
      <div className="relative flex items-center justify-between min-h-[44px]">
        <div className="relative z-10 flex shrink-0 items-center justify-start">{left}</div>
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-[4.5rem]"
          aria-hidden
        >
          <SolomonCenteredLogo />
        </div>
        <div className="relative z-10 flex shrink-0 items-center justify-end min-w-[44px]">
          {right}
        </div>
      </div>
    </header>
  );
}
