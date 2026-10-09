import { useEffect } from 'react';
import Head from 'next/head';
import Header from '../navigation/Header';
import Footer from '../navigation/Footer';
import AtomicGlowBackground from './AtomicGlowBackground';

// Global Atomic theme colors
const ATOMIC_THEME = {
  bg: '#000208',
  cardBg: '#000811',
  cardBorder: '#1A2A3A',
  textPrimary: '#EAF6FF',
  textSecondary: '#9FB3C8',
  textMuted: '#6B7C8F',
  accentCyan: '#00E5FF',
  accentOrange: '#FF7A1A',
  tealHighlight: '#00C2B8',
};

export default function HomeLayout({ children, title = 'Atomic Repair | Appliance Repair Toledo' }) {
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
      <AtomicGlowBackground />

      <Head>
        <title>{title}</title>
        <meta name="description" content="Fast, reliable appliance repair in Toledo. Same-day service, honest diagnostics, no surprises." />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preload" href="/arpano-800.webp" as="image" type="image/webp" />
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

export { ATOMIC_THEME };
