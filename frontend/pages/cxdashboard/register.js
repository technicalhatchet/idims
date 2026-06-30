/**
 * Client Portal Registration Page
 * Clients land here from the invite email link.
 * URL: /cxdashboard/register?token=...
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function PortalRegister() {
  const router = useRouter();
  const { token } = router.query;

  const [state, setState] = useState('validating'); // validating | valid | invalid | registering | success | error
  const [clientInfo, setClientInfo] = useState(null);
  const [error, setError] = useState(null);

  // Validate the invite token on load
  useEffect(() => {
    if (!token) return;

    fetch(`/api/portal/validate-invite?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setClientInfo(data.client);
          setState('valid');
        } else {
          setError(data.message || 'This invite link is invalid or has expired.');
          setState('invalid');
        }
      })
      .catch(() => {
        setError('Unable to validate invite link. Please try again.');
        setState('invalid');
      });
  }, [token]);

  // Already logged in — link from dashboard instead of another Auth0 consent screen
  useEffect(() => {
    if (!token || state !== 'valid') return;
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (!session?.user) return;
        sessionStorage.setItem('portal_invite_token', token);
        router.replace('/cxdashboard');
      })
      .catch(() => {});
  }, [token, state, router]);

  const handleRegister = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('portal_invite_token', token);
    const params = new URLSearchParams({
      returnTo: '/cxdashboard',
      screen_hint: 'signup',
    });
    if (clientInfo?.email) {
      params.set('login_hint', clientInfo.email);
    }
    window.location.href = `/api/auth/login?${params.toString()}`;
  };

  return (
    <>
      <Head>
        <title>Create Your Account | Atomic Repair</title>
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
          maxWidth: '420px',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img src="/arpano.png" alt="Atomic Repair" style={{ height: '40px', objectFit: 'contain' }} />
          </div>

          {state === 'validating' && (
            <div style={{ textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <p>Validating your invite...</p>
            </div>
          )}

          {state === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
              <h2 style={{ color: '#f87171', marginBottom: '0.5rem' }}>Invalid Invite</h2>
              <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>{error}</p>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Please contact Atomic Repair to request a new invite link.
              </p>
            </div>
          )}

          {state === 'valid' && clientInfo && (
            <div>
              <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                Welcome, {clientInfo.first_name}!
              </h2>
              <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
                Create your account to access your service history, upcoming appointments, and invoices.
              </p>

              <div style={{
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.15)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '2rem',
              }}>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Account for</p>
                <p style={{ color: '#fff', fontWeight: '600' }}>{clientInfo.first_name} {clientInfo.last_name}</p>
                {clientInfo.company_name && (
                  <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{clientInfo.company_name}</p>
                )}
                {clientInfo.email && (
                  <p style={{ color: '#00D4FF', fontSize: '0.875rem' }}>{clientInfo.email}</p>
                )}
              </div>

              <button
                onClick={handleRegister}
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
                }}
              >
                Create My Account
              </button>

              <p style={{ color: '#6b7280', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem' }}>
                Use the email shown above when creating your account.
                Signing in with a different Google or Apple email will not link to this client record.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
