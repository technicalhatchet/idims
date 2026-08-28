'use client';

import Link from 'next/link';
import { FaChevronRight, FaPlus } from 'react-icons/fa';
import SolomonInstallHint from './SolomonInstallHint';
import SolomonHomeHeader from './SolomonHomeHeader';
import SolomonBackdrop from './SolomonBackdrop';
import SolomonSessionOverlay from './SolomonSessionOverlay';
import SolomonHomeMenuGrid from './SolomonHomeMenuGrid';
import SolomonSmarterCard from './SolomonSmarterCard';
import SolomonOfflineFooter from './SolomonOfflineFooter';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useSolomonContinue } from '../../hooks/useSolomonContinue';
import { useSolomonTopInset, solomonSafeBottom } from './solomonSafeArea';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';
import { SOLOMON_Z, SOLOMON_LAYOUT } from './solomonHeroComposition';

export default function SolomonHomePage() {
  const { isDiyer, isStaff, canUseSolomon } = useSolomonAuth();
  const { continueTarget, isLoading: continueLoading } = useSolomonContinue();
  const topInset = useSolomonTopInset();

  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';
  const newTitle = isDiyer ? 'Start troubleshooting' : 'New diagnostic';
  const newSubtitle = isDiyer
    ? 'Walk through symptoms step by step'
    : 'Start a new guided diagnostic';

  const hasActiveSession = canUseSolomon && !continueLoading && continueTarget;

  return (
    <div className="relative min-h-screen text-white bg-[#070b14]">
      <main
        className="relative mx-auto max-w-lg"
        style={{
          ...topInset,
          ...solomonSafeBottom,
          paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <SolomonBackdrop hasActiveSession={hasActiveSession} />
        <SolomonSessionOverlay
          hasActiveSession={hasActiveSession}
          continueTarget={continueTarget}
        />

        <div className="relative px-4" style={{ zIndex: SOLOMON_Z.pageContent }}>
          <SolomonInstallHint />

          <div className="relative" style={{ zIndex: SOLOMON_Z.header }}>
            <SolomonHomeHeader isStaff={isStaff} />
          </div>

          {hasActiveSession ? (
            <div
              style={{
                height: `calc(9.5rem + ${SOLOMON_LAYOUT.uiStackOffsetY} + ${SOLOMON_LAYOUT.sessionToNewDiagnosticGap})`,
              }}
              aria-hidden
            />
          ) : (
            <div
              style={{ height: `calc(10rem + ${SOLOMON_LAYOUT.uiStackOffsetY})` }}
              aria-hidden
            />
          )}

          {canUseSolomon ? (
            <div className="space-y-2">
              <Link
                href={newHref}
                className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-3 py-2.5 shadow-[0_4px_16px_rgba(0,137,185,0.35)] hover:from-[#0099cc] hover:to-[#007aa8] transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10">
                  <FaPlus size={12} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white block leading-tight">
                    {newTitle}
                  </span>
                  <span className="text-[11px] text-cyan-100/75 block leading-snug">
                    {newSubtitle}
                  </span>
                </span>
                <FaChevronRight size={11} className="text-white/60 shrink-0" />
              </Link>

              <div className="relative -mx-4 px-4">
                <SolomonHomeMenuGrid isDiyer={isDiyer} isStaff={isStaff} />
              </div>

              <SolomonSmarterCard isDiyer={isDiyer} />

              <SolomonOfflineFooter syncReferenceTime={continueTarget?.updated_at} />
            </div>
          ) : (
            <div>
              <Link
                href="/solomon/signup"
                className="block rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-3 py-2.5 text-center text-sm font-semibold"
              >
                Create homeowner account to start
              </Link>
            </div>
          )}

          <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
            {!isStaff && !isDiyer ? (
              <Link
                href="/solomon/signup"
                className="block text-center text-xs text-cyan-400 hover:text-cyan-300"
              >
                Homeowner? Create a free account →
              </Link>
            ) : null}
            <a
              href={solomonLoginUrl()}
              className="block text-center text-[11px] text-white/45 hover:text-white/65"
            >
              Sign in with another account
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
