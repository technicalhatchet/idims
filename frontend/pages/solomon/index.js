import Link from 'next/link';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonInstallHint from '../../components/solomon/SolomonInstallHint';
import SolomonPageMain from '../../components/solomon/SolomonPageMain';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';

export default function SolomonHomePage() {
  const { isDiyer, isStaff } = useSolomonAuth();

  return (
    <>
      <SolomonHead />
      <SolomonPageMain>
        <SolomonInstallHint />

        <header className="mb-10 text-center sm:text-left">
          <img
            src="/solomon%20big.png"
            alt="Solomon"
            className="h-16 w-auto mb-4 mx-auto sm:mx-0"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            {isDiyer ? 'Appliance help at home' : 'Guided diagnostics'}
          </h1>
          <p className="text-sm text-white/70 mt-2 max-w-md mx-auto sm:mx-0">
            {isDiyer
              ? 'Step through symptoms, save your diagnostic notes, and optionally share outcomes for review.'
              : 'Standalone training and field diagnostics — no work order required.'}
          </p>
        </header>

        <div className="space-y-3">
          <Link
            href={isDiyer ? '/solomon/start' : '/solomon/diagnose'}
            className="block rounded-xl bg-[#0089B9] px-4 py-4 text-center font-medium"
          >
            {isDiyer ? 'Start troubleshooting' : 'New diagnostic'}
          </Link>
          <Link
            href="/solomon/diagnostics"
            className="block rounded-xl border border-white/20 px-4 py-4 text-center"
          >
            My diagnostics
          </Link>
          <Link
            href="/solomon/outcomes"
            className="block rounded-xl border border-white/20 px-4 py-4 text-center"
          >
            {isDiyer ? 'My repair notes' : 'Repair outcomes'}
          </Link>
        </div>

        <div className="mt-8 space-y-3 border-t border-white/10 pt-6">
          {!isStaff && !isDiyer ? (
            <Link
              href="/solomon/signup"
              className="block text-center text-sm text-cyan-400 hover:text-cyan-300"
            >
              Homeowner? Create a free account →
            </Link>
          ) : null}
          <a href={solomonLoginUrl()} className="block text-center text-xs text-white/50 hover:text-white/70">
            Sign in with another account
          </a>
        </div>

        <p className="text-xs text-white/40 mt-10 text-center">
          Guided diagnostics · repair memory
        </p>
      </SolomonPageMain>
    </>
  );
}
