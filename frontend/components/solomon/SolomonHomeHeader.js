'use client';

import Link from 'next/link';
import { FaCog, FaQuestionCircle } from 'react-icons/fa';

export default function SolomonHomeHeader({ isStaff = false }) {
  return (
    <header className="flex items-center justify-between gap-3 mb-4">
      <div className="min-w-0 flex-1">
        <img
          src="/solomon%20big.png"
          alt="Solomon Guided Diagnostics"
          className="h-8 w-auto max-w-[200px] object-contain object-left"
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href="/contact"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-cyan-400/90 hover:bg-white/5 hover:text-cyan-300"
          aria-label="Help"
        >
          <FaQuestionCircle size={18} />
        </Link>
        {isStaff ? (
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-cyan-400/90 hover:bg-white/5 hover:text-cyan-300"
            aria-label="Settings"
          >
            <FaCog size={18} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
