'use client';

import Link from 'next/link';
import { FaCog, FaQuestionCircle } from 'react-icons/fa';

export default function SolomonHomeHeader({ isStaff = false, className = '' }) {
  return (
    <header className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0 flex-1 pt-0.5">
        <img
          src="/solomon%20big.png"
          alt="Solomon Guided Diagnostics"
          className="h-[32px] w-auto max-w-[min(100%,200px)] object-contain object-left drop-shadow-[0_0_12px_rgba(0,180,255,0.25)]"
        />
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Link
          href="/contact"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-cyan-300/90 hover:bg-white/5"
          aria-label="Help"
        >
          <FaQuestionCircle size={14} />
        </Link>
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
