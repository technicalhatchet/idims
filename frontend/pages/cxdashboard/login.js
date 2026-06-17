/**
 * Client Portal Login Page
 * /cxdashboard/login
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import ClientPwaHead from '../../components/cxdashboard/ClientPwaHead';

const PORTAL_SHELL = '#0B0F1A';

export default function PortalLogin() {
  const router = useRouter();
  const { returnTo } = router.query;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;

    html.style.backgroundColor = PORTAL_SHELL;
    body.style.backgroundColor = PORTAL_SHELL;

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  const handleLogin = () => {
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    window.location.href = `/api/auth/login?returnTo=/cxdashboard`;
  };

  return (
    <>
      <ClientPwaHead />
      <Head>
        <title>Client Portal | Atomic Repair</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div style={{
        minHeight: '100vh',
        background: '#0A0F1E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          background: '#0D1525',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <img src="/arpano.png" alt="Atomic Repair" style={{ height: '40px', objectFit: 'contain', marginBottom: '2rem' }} />

          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            Client Portal
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
            Sign in to view your appointments, repairs, and invoices.
          </p>

          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: '#00D4FF',
              color: '#0A0F1E',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '1rem',
              cursor: 'pointer',
              marginBottom: '1rem',
            }}
          >
            Sign In
          </button>

          <p style={{ color: '#6b7280', fontSize: '0.75rem' }}>
            Don&apos;t have an account?{' '}
            <span style={{ color: '#00D4FF' }}>
              Check your email for an invite from Atomic Repair.
            </span>
          </p>
        </div>
      </div>
    </>
  );
}
