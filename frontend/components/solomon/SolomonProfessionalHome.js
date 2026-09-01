'use client';

import Link from 'next/link';
import {
  FaChevronRight,
  FaClipboardList,
  FaHashtag,
  FaPlus,
  FaSearch,
  FaWrench,
} from 'react-icons/fa';
import SolomonHomeHeader from './SolomonHomeHeader';
import SolomonActiveSessionCard from './SolomonActiveSessionCard';
import SolomonDiagnosticListCard from './SolomonDiagnosticListCard';
import SolomonMetricRow from './SolomonMetricRow';
import SolomonOfflineFooter from './SolomonOfflineFooter';
import SolomonInstallHint, { useSolomonInstallHint } from './SolomonInstallHint';
import SolomonBottomNav from './SolomonBottomNav';
import { SOLOMON_LIST_STACK_CLASS } from './solomonListPageUi';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useSolomonContinue } from '../../hooks/useSolomonContinue';
import { useSolomonHomeDashboard } from '../../hooks/useSolomonHomeDashboard';
import { useSolomonTopInset, solomonBottomNavScrollPadding, solomonFooterScrollPadding } from './solomonSafeArea';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';
import useSolomonBottomNavVisible from '../../hooks/useSolomonBottomNavVisible';
import LoadingSpinner from '../ui/LoadingSpinner';

function solomonUserFirstName(user) {
  if (!user) return null;
  if (user.given_name) return user.given_name;
  if (user.name) return user.name.split(' ')[0];
  return null;
}

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const QUICK_ACTIONS = [
  {
    href: '/solomon/diagnostics',
    label: 'Sessions',
    icon: FaClipboardList,
    iconClass: 'text-[var(--solomon-status-diagnostic)] bg-cyan-500/10',
  },
  {
    href: '/solomon/outcomes',
    labelKey: 'outcomes',
    icon: FaWrench,
    iconClass: 'text-[var(--solomon-status-repair)] bg-orange-500/10',
  },
  {
    href: '/solomon/knowledge',
    label: 'Knowledge',
    icon: FaSearch,
    iconClass: 'text-[var(--solomon-status-memory)] bg-purple-500/10',
  },
  {
    href: '/solomon/codes',
    label: 'Codes',
    icon: FaHashtag,
    iconClass: 'text-emerald-400 bg-emerald-500/10',
  },
];

function QuickActionTile({ href, label, icon: Icon, iconClass }) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-1 py-2 transition-colors hover:bg-[var(--solomon-surface-elevated)]"
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon size={14} aria-hidden />
      </span>
      <span className="text-[10px] font-medium text-[var(--solomon-text-secondary)] text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}

function KnowledgeBanner({ isDiyer }) {
  return (
    <div className="rounded-[var(--solomon-radius-card)] border border-orange-500/25 bg-[var(--solomon-surface)] px-3 py-2.5">
      <p className="text-xs font-semibold text-orange-300">Smarter every time.</p>
      <p className="text-[11px] text-[var(--solomon-text-secondary)] mt-0.5 leading-snug">
        {isDiyer
          ? 'Your diagnostics build your repair memory, making you faster and more accurate.'
          : 'Your diagnostics build your repair memory, making you faster and more accurate.'}
      </p>
      <Link
        href="/solomon/knowledge"
        className="text-[10px] text-[var(--solomon-primary-from)] mt-1.5 inline-block hover:opacity-90"
      >
        Explore repair memory →
      </Link>
    </div>
  );
}

export default function SolomonProfessionalHome() {
  const { user, isDiyer, isStaff, canUseSolomon } = useSolomonAuth();
  const { continueTarget, isLoading: continueLoading } = useSolomonContinue();
  const { diagnostics, metrics, isLoading: dashboardLoading } = useSolomonHomeDashboard({
    enabled: canUseSolomon,
  });
  const topInset = useSolomonTopInset();
  const installHint = useSolomonInstallHint();
  const showBottomNav = useSolomonBottomNavVisible();

  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';
  const newTitle = isDiyer ? 'Start troubleshooting' : 'New diagnostic';
  const hasActiveSession = canUseSolomon && !continueLoading && continueTarget;

  const firstName = solomonUserFirstName(user);
  const greeting = greetingForHour(new Date().getHours());
  const greetingLine = firstName ? `${greeting}, ${firstName}` : greeting;

  const recentDiagnostics = diagnostics
    .filter((item) => item.id !== continueTarget?.id)
    .slice(0, 4);

  const mainPaddingBottom = showBottomNav
    ? solomonBottomNavScrollPadding(1)
    : solomonFooterScrollPadding(4);

  return (
    <div className="relative min-h-screen min-w-0 overflow-x-hidden text-[var(--solomon-text-primary)] bg-[var(--solomon-bg-canvas)]">
      <main
        className="relative mx-auto max-w-lg min-w-0 px-4"
        style={{
          ...topInset,
          paddingBottom: mainPaddingBottom,
        }}
      >
        <SolomonInstallHint installHint={installHint} />

        <div className="pt-1 pb-4">
          <SolomonHomeHeader isStaff={isStaff} />
        </div>

        {canUseSolomon ? (
          <div className="space-y-4">
            <header>
              <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--solomon-text-primary)] leading-tight">
                {greetingLine}
              </h1>
              <p className="text-sm text-[var(--solomon-text-secondary)] mt-1">
                {isDiyer ? 'Your troubleshooting command center' : 'Your diagnostic command center'}
              </p>
            </header>

            <SolomonMetricRow metrics={metrics} isLoading={dashboardLoading} />

            <Link
              href={newHref}
              data-solomon-primary-cta
              className="flex min-h-[44px] items-center gap-3 rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-primary-border)] bg-gradient-to-r from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-3 py-2.5 text-white shadow-[var(--solomon-primary-shadow)] transition-opacity hover:opacity-95"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10">
                <FaPlus size={12} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 font-semibold">{newTitle}</span>
              <FaChevronRight size={11} className="shrink-0 text-white/70" aria-hidden />
            </Link>

            {hasActiveSession ? (
              <section aria-label="Continue session">
                <SolomonActiveSessionCard target={continueTarget} />
              </section>
            ) : null}

            <section aria-labelledby="solomon-recent-diagnostics-heading">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2
                  id="solomon-recent-diagnostics-heading"
                  className="text-sm font-semibold text-[var(--solomon-text-primary)]"
                >
                  Recent diagnostics
                </h2>
                <Link
                  href="/solomon/diagnostics"
                  className="text-[11px] text-[var(--solomon-primary-from)] hover:opacity-90"
                >
                  View all
                </Link>
              </div>

              {dashboardLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : recentDiagnostics.length === 0 ? (
                <p className="rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-6 text-center text-sm text-[var(--solomon-text-secondary)]">
                  {isDiyer ? 'No troubleshooting sessions yet.' : 'No diagnostics yet.'}
                </p>
              ) : (
                <div className={SOLOMON_LIST_STACK_CLASS}>
                  {recentDiagnostics.map((item) => (
                    <SolomonDiagnosticListCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="solomon-quick-actions-heading">
              <h2
                id="solomon-quick-actions-heading"
                className="mb-2 text-sm font-semibold text-[var(--solomon-text-primary)]"
              >
                Quick actions
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_ACTIONS.map((action) => {
                  const label = action.labelKey === 'outcomes'
                    ? (isDiyer ? 'Notes' : 'Outcomes')
                    : action.label;
                  return (
                    <QuickActionTile
                      key={action.href}
                      href={action.href}
                      label={label}
                      icon={action.icon}
                      iconClass={action.iconClass}
                    />
                  );
                })}
              </div>
            </section>

            <KnowledgeBanner isDiyer={isDiyer} />

            <SolomonOfflineFooter syncReferenceTime={continueTarget?.updated_at} />
          </div>
        ) : (
          <div className="space-y-4">
            <header>
              <h1 className="text-[1.65rem] font-bold tracking-tight leading-tight">{greetingLine}</h1>
              <p className="text-sm text-[var(--solomon-text-secondary)] mt-1">
                Sign in to start guided diagnostics.
              </p>
            </header>
            <Link
              href="/solomon/signup"
              className="block rounded-[var(--solomon-radius-card)] bg-gradient-to-r from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-3 py-2.5 text-center text-sm font-semibold text-white"
            >
              Create homeowner account to start
            </Link>
          </div>
        )}

        <div className="mt-5 space-y-2 border-t border-[color:var(--solomon-border-muted)] pt-4">
          {!isStaff && !isDiyer ? (
            <Link
              href="/solomon/signup"
              className="block text-center text-xs text-[var(--solomon-primary-from)] hover:opacity-90"
            >
              Homeowner? Create a free account →
            </Link>
          ) : null}
          <a
            href={solomonLoginUrl()}
            className="block text-center text-[11px] text-[var(--solomon-text-muted)] hover:text-[var(--solomon-text-secondary)]"
          >
            Sign in with another account
          </a>
        </div>
      </main>
      {showBottomNav ? <SolomonBottomNav /> : null}
    </div>
  );
}
