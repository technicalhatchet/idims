import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ClientPwaHead from './ClientPwaHead';

const PORTAL_SHELL = '#0B0F1A';

export default function DashboardLayout({ children, title = 'Client Portal', user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevColorScheme = html.style.colorScheme;

    html.style.backgroundColor = PORTAL_SHELL;
    body.style.backgroundColor = PORTAL_SHELL;
    html.style.colorScheme = 'dark';

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      html.style.colorScheme = prevColorScheme;
    };
  }, []);

  return (
    <>
      <ClientPwaHead />
      <Head>
        <title>{title} | Atomic Repair</title>
        <meta name="description" content="Manage your appliance repairs, appointments, and invoices." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-[#0B0F1A]">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="min-h-screen flex flex-col lg:ml-64">
          <Topbar
            user={user}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
