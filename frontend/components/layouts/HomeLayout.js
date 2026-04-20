import { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../navigation/Header';
import Footer from '../navigation/Footer';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useTheme } from '../../context/ThemeContext';

export default function HomeLayout({ children, title = 'Service Business Management' }) {
  const { user, isLoading } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After mounting, we can safely show the UI that depends on the theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // To avoid hydration mismatch, only show theme-dependent UI after mounting
  if (!mounted) {
    return null;
  }

  return (
    <div className={`min-h-screen flex flex-col ${theme.mode === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Service business management application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header 
        user={user} 
        isLoading={isLoading} 
        darkMode={theme.mode === 'dark'} 
        toggleTheme={toggleTheme} 
      />

      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>

      <Footer />
    </div>
  );
}