'use client';

import Link from 'next/link';
import { FaChevronRight, FaPlus } from 'react-icons/fa';
import SolomonInstallHint, { useSolomonInstallHint } from './SolomonInstallHint';
import SolomonHomeHeader from './SolomonHomeHeader';
import SolomonHeroArtboard from './SolomonHeroArtboard';
import SolomonHomeMenuGrid from './SolomonHomeMenuGrid';
import SolomonSmarterCard from './SolomonSmarterCard';
import SolomonOfflineFooter from './SolomonOfflineFooter';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useSolomonContinue } from '../../hooks/useSolomonContinue';
import { useSolomonTopInset, solomonSafeBottom } from './solomonSafeArea';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';
import { SOLOMON_Z, SOLOMON_PRIMARY_CTA_CLASS, solomonContentSpacerStyle, solomonPrimaryCtaLabelStyle } from './solomonHeroComposition';

export default function SolomonHomePage() {
  const { isDiyer, isStaff, canUseSolomon } = useSolomonAuth();
  const { continueTarget, isLoading: continueLoading } = useSolomonContinue();
  const topInset = useSolomonTopInset();

  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';
  const newTitle = isDiyer ? 'Start troubleshooting' : 'New diagnostic';
  const newSubtitle = isDiyer ? 'Walk through symptoms step by step' : null;

  const hasActiveSession = canUseSolomon && !continueLoading && continueTarget;
  const installHint = useSolomonInstallHint();
  const ctaLabels = solomonPrimaryCtaLabelStyle({ longTitle: isDiyer, singleLine: !newSubtitle });

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
        <SolomonHeroArtboard
          hasActiveSession={hasActiveSession}
          continueTarget={continueTarget}
        />

        <div className="relative px-4" style={{ zIndex: SOLOMON_Z.pageContent }}>
          <SolomonInstallHint installHint={installHint} />

          <div className="relative" style={{ zIndex: SOLOMON_Z.header }}>
            <SolomonHomeHeader isStaff={isStaff} />
          </div>

          <div
            style={solomonContentSpacerStyle({ hasActiveSession, installHintVisible: installHint.visible })}
            aria-hidden
          />

          {canUseSolomon ? (
            <div className="space-y-2">
              <Link
                href={newHref}
                className={SOLOMON_PRIMARY_CTA_CLASS}
                style={{
                  WebkitTextSizeAdjust: '100%',
                  textSizeAdjust: '100%',
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10">
                  <FaPlus size={12} />
                </span>
                <span
                  className={`min-h-0 min-w-0 flex-1 ${
                    newSubtitle
                      ? 'grid gap-0.5 overflow-hidden'
                      : 'flex items-center'
                  }`}
                  style={{
                    WebkitTextSizeAdjust: '100%',
                    textSizeAdjust: '100%',
                  }}
                >
                  <span
                    className="min-w-0 font-semibold text-white [overflow-x:clip] [text-overflow:ellipsis] whitespace-nowrap"
                    style={ctaLabels.title}
                  >
                    {newTitle}
                  </span>
                  {newSubtitle ? (
                    <span
                      className="min-w-0 [overflow-x:clip] [text-overflow:ellipsis] whitespace-nowrap text-cyan-100/75"
                      style={ctaLabels.subtitle}
                    >
                      {newSubtitle}
                    </span>
                  ) : null}
                </span>
                <FaChevronRight size={11} className="shrink-0 text-white/60" />
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
