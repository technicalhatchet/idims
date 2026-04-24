import { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../navigation/Header';
import Footer from '../navigation/Footer';
import { useUser } from '@auth0/nextjs-auth0/client';

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
    <div className="min-h-screen flex flex-col bg-[#0B0F1A]">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Fast, reliable appliance repair in Toledo. Same-day service, honest diagnostics, no surprises." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header user={user} isLoading={isLoading} />

      <main className="flex-grow">
        {children}
      </main>

      <Footer />
    </div>
  );
}
