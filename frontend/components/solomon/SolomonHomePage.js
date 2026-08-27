'use client';

import Link from 'next/link';
import { FaChevronRight, FaPlus } from 'react-icons/fa';
import SolomonInstallHint from './SolomonInstallHint';
import SolomonHomeHeader from './SolomonHomeHeader';
import SolomonActiveSessionCard from './SolomonActiveSessionCard';
import SolomonHomeMenuGrid from './SolomonHomeMenuGrid';
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

  return (
    <div className="relative min-h-screen text-white">
      <div className="fixed inset-0 -z-10 bg-[#0A0F1E]">
        <img
          src={COSMIC_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[#0A0F1E]/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F1E]/30 via-transparent to-[#0A0F1E]" />
      </div>

      <main
        className="relative max-w-lg mx-auto px-5"
        style={{
          ...topInset,
          ...solomonSafeBottom,
          paddingBottom: 'max(6rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <SolomonInstallHint />
        <SolomonHomeHeader isStaff={isStaff} />

        <section className="relative -mx-2 mb-5 flex justify-center">
          <img
            src={WIZARD_HERO}
            alt="Solomon wizard"
            className="h-[min(220px,42vw)] w-auto max-w-full object-contain drop-shadow-[0_8px_32px_rgba(0,137,185,0.35)]"
            decoding="async"
          />
        </section>

        {canUseSolomon ? (
          <div className="space-y-4">
            {!continueLoading && continueTarget ? (
              <SolomonActiveSessionCard target={continueTarget} />
            ) : null}

            <Link
              href={newHref}
              className="flex items-center justify-between gap-3 rounded-xl bg-[#0089B9] px-4 py-4 font-medium shadow-lg shadow-cyan-900/30 hover:bg-[#0099cc] transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                  <FaPlus size={14} />
                </span>
                {isDiyer ? 'Start troubleshooting' : 'New diagnostic'}
              </span>
              <FaChevronRight size={14} className="text-white/70" />
            </Link>

            <SolomonHomeMenuGrid isDiyer={isDiyer} isStaff={isStaff} />

            <div className="rounded-xl border border-white/10 bg-[#0D1525]/90 backdrop-blur-sm px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-400/85">
                Smarter every time
              </p>
              <p className="text-sm text-gray-300 mt-1 leading-snug">
                {isDiyer
                  ? 'Each repair note helps Solomon surface patterns that match your appliance.'
                  : 'Repair outcomes and memory search sharpen the next guided diagnostic.'}
              </p>
              <Link
                href="/solomon/knowledge"
                className="text-xs text-cyan-400 mt-2 inline-block hover:text-cyan-300"
              >
                Explore repair memory →
              </Link>
            </div>
          </div>
        ) : (
          <Link
            href="/solomon/signup"
            className="block rounded-xl bg-[#0089B9] px-4 py-4 text-center font-medium"
          >
            Create homeowner account to start
          </Link>
        )}

        <div className="mt-8 space-y-3 border-t border-white/10 pt-6">
          {!isStaff && !isDiyer ? (
            <Link
              href="/solomon/signup"
              className="block text-center text-sm text-cyan-400 hover:text-cyan-300"
            >
              Homeowner? Create a free account →
            </Link>
          ) : null}
          <a
            href={solomonLoginUrl()}
            className="block text-center text-xs text-white/50 hover:text-white/70"
          >
            Sign in with another account
          </a>
        </div>

        <div className="mt-8 pb-2">
          <SolomonOfflineFooter />
        </div>
      </main>
    </div>
  );
}
