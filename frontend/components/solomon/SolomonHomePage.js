'use client';

import Link from 'next/link';
import { FaChevronRight, FaPlus } from 'react-icons/fa';
import SolomonInstallHint from './SolomonInstallHint';
import SolomonHomeHeader from './SolomonHomeHeader';
import SolomonActiveSessionCard from './SolomonActiveSessionCard';
import SolomonHomeMenuGrid from './SolomonHomeMenuGrid';
import SolomonSmarterCard from './SolomonSmarterCard';
import SolomonOfflineFooter from './SolomonOfflineFooter';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useSolomonContinue } from '../../hooks/useSolomonContinue';
import { useSolomonTopInset, solomonSafeBottom } from './solomonSafeArea';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';

const COSMIC_BG = '/images/solomonwiz/blueoragnecosmicbg.png';
const WIZARD_HERO = '/images/solomonwiz/wizbookwrench.png';

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
  const heroHeight = hasActiveSession
    ? 'min(52vh, 300px)'
    : 'min(38vh, 200px)';

  return (
    <div className="relative min-h-screen text-white">
      <div className="fixed inset-0 -z-30 bg-[#070b14]" aria-hidden />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-x-hidden">
        <img
          src={WIZARD_HERO}
          alt=""
          className="relative block w-full h-auto max-w-none select-none"
          decoding="async"
        />
      </div>

      <main
        className="relative z-10 mx-auto max-w-lg"
        style={{
          ...topInset,
          ...solomonSafeBottom,
          paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="px-4">
          <SolomonInstallHint />

          {/* Hero visual stage — artwork extends behind session card, no bottom clip */}
          <div className="relative -mx-4 overflow-x-hidden">
            <div
              className="absolute inset-x-0 top-0 z-0 pointer-events-none overflow-x-hidden overflow-y-visible"
              style={{ height: heroHeight }}
            >
              <img
                src={COSMIC_BG}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[center_30%] scale-105"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/20 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-[#070b14]/20" />

              <div className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-r from-[#070b14]/30 via-transparent to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-[#070b14]/25 via-transparent to-transparent pointer-events-none" />
            </div>

            <div
              className="relative z-10"
              style={{ minHeight: heroHeight }}
            >
              <div className="px-4 pt-0.5">
                <SolomonHomeHeader isStaff={isStaff} />
              </div>

              {hasActiveSession ? (
                <div
                  className="absolute z-20 left-4 bottom-0 w-[68%] max-w-[68%] min-w-[min(100%,200px)]"
                >
                  <SolomonActiveSessionCard
                    target={continueTarget}
                    variant="heroOverlay"
                  />
                </div>
              ) : null}
            </div>
          </div>

          {canUseSolomon ? (
            <div className="relative z-20 mt-2.5 space-y-2">
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
                <div
                  className="pointer-events-none absolute inset-0 bg-[#070b14]/10"
                  aria-hidden
                />
                <div className="relative">
                  <SolomonHomeMenuGrid isDiyer={isDiyer} isStaff={isStaff} />
                </div>
              </div>

              <SolomonSmarterCard isDiyer={isDiyer} />

              <SolomonOfflineFooter syncReferenceTime={continueTarget?.updated_at} />
            </div>
          ) : (
            <div className="relative z-20 mt-2.5">
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
