import Link from 'next/link';

/**
 * Centered Solomon logo header for full-screen diagnostic wizard shells.
 */
export default function SolomonWizardHeader({ left, right = null }) {
  return (
    <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 px-1">
      <div className="flex items-center justify-start min-w-[44px]">{left}</div>
      <div className="flex min-w-0 items-center justify-center px-1">
        <img
          src="/solomon%20big.png"
          alt=""
          aria-hidden
          className="h-9 w-auto max-w-[min(100%,200px)] object-contain object-center sm:max-h-10"
          decoding="async"
        />
      </div>
      <div className="flex items-center justify-end min-w-[44px]">{right}</div>
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
