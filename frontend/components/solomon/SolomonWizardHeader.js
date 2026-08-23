import Link from 'next/link';

/**
 * Full-width centered logo with optional left/right controls (mobile wizard shell).
 */
export default function SolomonWizardHeader({ left, right = null }) {
  return (
    <div className="relative min-h-[44px] px-1">
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none px-14"
        aria-hidden
      >
        <img
          src="/solomon%20big.png"
          alt=""
          className="h-9 w-auto max-w-[min(100%,200px)] object-contain object-center sm:max-h-10"
          decoding="async"
        />
      </div>
      <div className="relative z-10 flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center justify-start min-w-[44px] shrink-0">{left}</div>
        <div className="flex items-center justify-end min-w-[44px] shrink-0">{right}</div>
      </div>
    </div>
  );
}

export function SolomonWizardBackLink({ href = '/solomon', label = '←' }) {
  return (
    <Link href={href} className="text-sm text-cyan-400 hover:text-cyan-300 p-1 -ml-1">
      {label}
    </Link>
  );
}
