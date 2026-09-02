'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { FaChevronRight, FaPlus } from 'react-icons/fa';
import SolomonInstallHint, { useSolomonInstallHint } from './SolomonInstallHint';
import SolomonHomeHeader from './SolomonHomeHeader';
import SolomonHeroArtboard from './SolomonHeroArtboard';
import SolomonHomeMenuGrid from './SolomonHomeMenuGrid';
import SolomonSmarterCard from './SolomonSmarterCard';
import SolomonOfflineFooter from './SolomonOfflineFooter';
import SolomonProfessionalHome from './SolomonProfessionalHome';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useSolomonContinue } from '../../hooks/useSolomonContinue';
import { useSolomonTheme } from '../../hooks/useSolomonTheme';
import { useSolomonTopInset, solomonBottomNavScrollPadding, solomonFooterScrollPadding } from './solomonSafeArea';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';
import { SOLOMON_Z, SOLOMON_PRIMARY_CTA_CLASS, solomonContentSpacerStyle, solomonPrimaryCtaLabelStyle } from './solomonHeroComposition';
import useSolomonBottomNavVisible from '../../hooks/useSolomonBottomNavVisible';
import SolomonBottomNav from './SolomonBottomNav';

function SolomonSignatureHome() {
  const { isDiyer, canUseSolomon } = useSolomonAuth();
  const { continueTarget, isLoading: continueLoading } = useSolomonContinue();
  const topInset = useSolomonTopInset();

  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';
  const newTitle = isDiyer ? 'Start troubleshooting' : 'New diagnostic';
  const newSubtitle = isDiyer ? 'Walk through symptoms step by step' : null;

  const hasActiveSession = canUseSolomon && !continueLoading && continueTarget;
  const installHint = useSolomonInstallHint();
  const ctaRef = useRef(null);
  const ctaLabels = solomonPrimaryCtaLabelStyle({ longTitle: isDiyer, singleLine: !newSubtitle });
  const showBottomNav = useSolomonBottomNavVisible();
  const mainPaddingBottom = showBottomNav
    ? solomonBottomNavScrollPadding(1)
    : solomonFooterScrollPadding(4);

  return (
    <div className="relative min-h-screen min-w-0 overflow-x-hidden text-white bg-[var(--solomon-bg-canvas)]">
      <main
        className="relative mx-auto max-w-lg min-w-0"
        style={{
          ...topInset,
          paddingBottom: mainPaddingBottom,
        }}
      >
        <SolomonHeroArtboard
          hasActiveSession={hasActiveSession}
          continueTarget={continueTarget}
          ctaRef={ctaRef}
          topInset={topInset.paddingTop}
        />

        <div className="relative px-4 pointer-events-none" style={{ zIndex: SOLOMON_Z.pageContent }}>
          <div className="pointer-events-auto">
            <SolomonInstallHint installHint={installHint} />
          </div>

          <div className="relative pointer-events-auto" style={{ zIndex: SOLOMON_Z.header }} data-solomon-home-header>
            <SolomonHomeHeader />
          </div>

          <div
            data-solomon-content-spacer
            style={solomonContentSpacerStyle({ hasActiveSession, installHintVisible: installHint.visible })}
            aria-hidden
          />

          {canUseSolomon ? (
            <div className="pointer-events-auto space-y-2">
              <Link
                ref={ctaRef}
                href={newHref}
                data-solomon-primary-cta
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
                <SolomonHomeMenuGrid isDiyer={isDiyer} />
              </div>

              <SolomonSmarterCard isDiyer={isDiyer} />

              <SolomonOfflineFooter syncReferenceTime={continueTarget?.updated_at} />
            </div>
          ) : (
            <div className="pointer-events-auto space-y-2">
              <Link
                href="/solomon/signup"
                className="block rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-3 py-2.5 text-center text-sm font-semibold"
              >
                Create homeowner account to start
              </Link>
              <a
                href={solomonLoginUrl()}
                className="block rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#e56a00] px-3 py-2.5 text-center text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,122,0,0.3)] hover:from-[#ff8a1a] hover:to-[#f07000] transition-colors"
              >
                Sign in
              </a>
            </div>
          )}
        </div>
      </main>
      {showBottomNav ? <SolomonBottomNav /> : null}
    </div>
  );
}

export default function SolomonHomePage() {
  const { isProfessional } = useSolomonTheme();

  if (isProfessional) {
    return <SolomonProfessionalHome />;
  }

  return <SolomonSignatureHome />;
}
