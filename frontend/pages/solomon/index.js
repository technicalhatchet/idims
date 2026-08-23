import Link from 'next/link';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonInstallHint from '../../components/solomon/SolomonInstallHint';
import SolomonPageMain from '../../components/solomon/SolomonPageMain';

export default function SolomonHomePage() {
  return (
    <>
      <SolomonHead />
      <SolomonPageMain>
        <SolomonInstallHint />

        <header className="mb-10">
          <img
            src="/solomon big.png"
            alt="Solomon"
            className="h-16 w-auto mb-4"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Guided Diagnostics</h1>
          <p className="text-sm text-white/70 mt-2">
            Standalone training and field diagnostics — no work order required.
          </p>
        </header>

        <div className="space-y-3">
          <Link
            href="/solomon/diagnose"
            className="block rounded-xl bg-[#0089B9] px-4 py-4 text-center font-medium"
          >
            New diagnostic
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
            Repair outcomes
          </Link>
        </div>

        <p className="text-xs text-white/40 mt-10 text-center">
          Guided diagnostics · repair memory
        </p>
      </SolomonPageMain>
    </>
  );
}
