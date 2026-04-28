import { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../navigation/Header';
import Footer from '../navigation/Footer';
import { useUser } from '@auth0/nextjs-auth0/client';

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

export default function HomeLayout({ children, title = 'Quantum Repair | Appliance Repair Toledo' }) {
  const { user, isLoading } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div 
      className="min-h-screen flex flex-col relative"
      style={{ backgroundColor: ATOMIC_THEME.bg }}
    >
      {/* Global Atomic Glow Blobs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-[700px] h-[700px] blur-[180px] top-[-100px] left-[-200px]"
          style={{ backgroundColor: 'rgba(0, 229, 255, 0.15)' }}
        />
        <div 
          className="absolute w-[500px] h-[500px] blur-[150px] bottom-[20%] right-[-100px]"
          style={{ backgroundColor: 'rgba(255, 122, 26, 0.18)' }}
        />
      </div>

      <Head>
        <title>{title}</title>
        <meta name="description" content="Fast, reliable appliance repair in Toledo. Same-day service, honest diagnostics, no surprises." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header user={user} isLoading={isLoading} />

      <main className="flex-grow relative z-10">
        {children}
      </main>

      <Footer />
    </div>
  );
}

export { ATOMIC_THEME };
