import { useEffect } from 'react';
import Head from 'next/head';
import Header from '../navigation/Header';
import Footer from '../navigation/Footer';
import AtomicGlowBackgroundOptimized from './AtomicGlowBackgroundOptimized';
import { ATOMIC_THEME } from './HomeLayout';

/**
 * Preview-only: mirrors HomeLayout with AtomicGlowBackgroundOptimized instead of production glow.
 * Used by NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=layout_shell_optimized_glow.
 */
export default function HomeLayoutDiagnosticOptimizedGlow({
  children,
  title = 'Atomic Repair | Appliance Repair Toledo',
}) {
  useEffect(() => {
    document.documentElement.classList.add('atomic-marketing');
    return () => {
      document.documentElement.classList.remove('atomic-marketing');
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col relative atomic-marketing-shell"
      style={{ backgroundColor: ATOMIC_THEME.bg }}
    >
      <AtomicGlowBackgroundOptimized />

      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="Fast, reliable appliance repair in Toledo. Same-day service, honest diagnostics, no surprises."
        />
        <link rel="icon" href="/favicon.ico" />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('atomic-marketing');`,
          }}
        />
      </Head>

      <Header />

      <main className="flex-grow relative z-10">
        {children}
      </main>

      <Footer />
    </div>
  );
}
