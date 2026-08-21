import Head from 'next/head';
import Link from 'next/link';

/**
 * Solomon standalone PWA shell — dashboard placeholder on feature/solomon-standalone.
 * Wizard, outcome linking, and lists will land here in follow-up PRs.
 */
export default function SolomonHomePage() {
  return (
    <>
      <Head>
        <title>Solomon</title>
        <meta name="application-name" content="Solomon" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Solomon" />
        <meta name="theme-color" content="#0A0F1E" />
        <link rel="manifest" href="/manifest-solomon.json" />
      </Head>
      <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-8 max-w-lg mx-auto">
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
      </main>
    </>
  );
}
