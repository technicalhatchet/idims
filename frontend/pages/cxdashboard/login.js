/**
 * Client Portal Login Page
 * /cxdashboard/login
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ClientPwaHead from '../../components/cxdashboard/ClientPwaHead';
import AtomicLogo from '../../components/ui/AtomicLogo';
import { portalSignInUrl, portalSignUpUrl } from '../../utils/portalAuthUrls';

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

  const returnPath = typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/cxdashboard';

  const handleSignIn = () => {
    window.location.href = portalSignInUrl(returnPath);
  };

  const handleSignUp = () => {
    window.location.href = portalSignUpUrl({ returnTo: returnPath });
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
          <AtomicLogo height={40} className="w-auto object-contain mb-8" />

          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            Client Portal
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Sign in to view appointments, service history, and invoices.
          </p>

          <button
            type="button"
            onClick={handleSignIn}
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
              marginBottom: '0.75rem',
            }}
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={handleSignUp}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'transparent',
              color: '#e5e7eb',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              marginBottom: '1.25rem',
            }}
          >
            Create account
          </button>

          <p style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: 1.55, textAlign: 'left' }}>
            <strong style={{ color: '#9ca3af' }}>Already booked with us?</strong>
            {' '}
            Create an account with the <strong style={{ color: '#9ca3af' }}>same email</strong> you used
            when you scheduled — we link your jobs automatically. No invite required.
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: 1.55, textAlign: 'left', marginTop: '0.75rem' }}>
            We can also email you an invite link from the office. Not a customer yet?{' '}
            <Link href="/book" style={{ color: '#00D4FF', textDecoration: 'none' }}>
              Book service online
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
