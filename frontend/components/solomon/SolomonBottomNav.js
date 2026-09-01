'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  FaBook,
  FaEllipsisH,
  FaHome,
  FaClipboardList,
  FaPlus,
} from 'react-icons/fa';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { isSolomonNavActive } from './solomonNavigation';

function NavTab({ href, label, icon: Icon, isActive, ariaLabel }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel || label}
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 transition-colors ${
        isActive
          ? 'text-[var(--solomon-primary-from)]'
          : 'text-[var(--solomon-text-muted)] hover:text-[var(--solomon-text-secondary)]'
      }`}
    >
      <Icon size={18} aria-hidden />
      <span className="text-[10px] font-medium leading-none tracking-wide">{label}</span>
      {isActive ? (
        <span className="mt-0.5 h-0.5 w-4 rounded-full bg-[var(--solomon-primary-from)]" aria-hidden />
      ) : (
        <span className="mt-0.5 h-0.5 w-4" aria-hidden />
      )}
    </Link>
  );
}

export default function SolomonBottomNav() {
  const router = useRouter();
  const { isDiyer } = useSolomonAuth();
  const pathname = router.pathname;

  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';
  const newLabel = isDiyer ? 'Start troubleshooting' : 'New diagnostic';

  return (
    <nav
      aria-label="Solomon primary"
      className="fixed bottom-0 left-0 right-0 z-[120] border-t border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-lg items-end justify-between px-2">
        <NavTab
          href="/solomon"
          label="Home"
          icon={FaHome}
          isActive={isSolomonNavActive(pathname, 'home')}
        />
        <NavTab
          href="/solomon/diagnostics"
          label="Sessions"
          icon={FaClipboardList}
          isActive={isSolomonNavActive(pathname, 'sessions')}
        />

        <div className="flex flex-1 flex-col items-center -mt-4 px-1">
          <Link
            href={newHref}
            aria-label={newLabel}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] text-white shadow-[var(--solomon-primary-shadow)] transition-transform active:scale-95"
          >
            <FaPlus size={18} aria-hidden />
          </Link>
        </div>

        <NavTab
          href="/solomon/knowledge"
          label="Knowledge"
          icon={FaBook}
          isActive={isSolomonNavActive(pathname, 'knowledge')}
        />
        <NavTab
          href="/solomon/more"
          label="More"
          icon={FaEllipsisH}
          isActive={isSolomonNavActive(pathname, 'more')}
        />
      </div>
    </nav>
  );
}
