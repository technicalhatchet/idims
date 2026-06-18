import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { FaShieldAlt, FaChevronRight, FaBoxOpen, FaTools } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import ApplianceIcon from '../../components/cxdashboard/ApplianceIcon';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

async function portalFetch(endpoint, token) {
  const impersonateId = typeof window !== 'undefined'
    ? sessionStorage.getItem('portal_impersonate_client_id')
    : null;
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = impersonateId
    ? `${BACKEND}/api/portal/${endpoint}${sep}admin_client_id=${impersonateId}`
    : `${BACKEND}/api/portal/${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Portal API error: ${res.status}`);
  return res.json();
}

function ApplianceCard({ appliance }) {
  const displayName = [appliance.make, appliance.subtype?.replace(/_/g, ' ')].filter(Boolean).join(' ')
    || appliance.type
    || 'Appliance';

  return (
    <Link href={`/cxdashboard/appliances/${encodeURIComponent(appliance.serial)}`}>
      <div
        style={{
          background: '#0D1525',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        className="hover:border-cyan-500/30 hover:bg-[#0f1a2e]"
      >
        <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
          <ApplianceIcon type={appliance.subtype || appliance.type} className="w-8 h-8" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: '#fff', fontWeight: '600', margin: 0, textTransform: 'capitalize' }}>
                {displayName}
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '2px 0 0' }}>
                {appliance.model && <span>{appliance.model}</span>}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {appliance.warranty_active && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  color: '#22c55e', fontSize: '0.75rem', fontWeight: '600',
                }}>
                  <FaShieldAlt style={{ fontSize: '10px' }} />
                  Warranty
                </span>
              )}
              {appliance.active_repair && (
                <span style={{
                  background: 'rgba(245,158,11,0.1)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                }}>
                  Active
                </span>
              )}
              <FaChevronRight style={{ color: '#6b7280', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem',
            fontSize: '0.8125rem', color: '#9ca3af',
          }}>
            <span style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '4px 8px' }}>
              <span style={{ color: '#6b7280' }}>S/N:</span>{' '}
              <span style={{ color: '#d1d5db', fontFamily: 'monospace' }}>{appliance.serial}</span>
            </span>
            <span>
              <span style={{ color: '#22d3ee', fontWeight: '600' }}>{appliance.service_count}</span> service{appliance.service_count !== 1 ? 's' : ''}
            </span>
            {appliance.last_service_date && (
              <span>
                Last: {format(parseISO(appliance.last_service_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>

          {appliance.property && (
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              📍 {appliance.property.address}{appliance.property.unit_number ? ` Unit ${appliance.property.unit_number}` : ''}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AppliancesPage() {
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const token = session.accessToken;
        const data = await portalFetch('appliances', token);
        setAppliances(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <Head><title>My Appliances | Atomic Repair</title></Head>
      <div className="space-y-6">
        <div>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>My Appliances</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Appliances we&apos;ve serviced with serial numbers on file
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading appliances...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>{error}</div>
        ) : appliances.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem',
            background: '#0D1525', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)'
          }}>
            <FaBoxOpen style={{ fontSize: '2.5rem', color: '#6b7280', marginBottom: '1rem', opacity: 0.4 }} />
            <p style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>No appliances with serial numbers on file</p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              When we service your appliances and record their serial numbers, they&apos;ll appear here with their full service history.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {appliances.map(a => <ApplianceCard key={a.serial} appliance={a} />)}
          </div>
        )}
      </div>
    </>
  );
}

AppliancesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="My Appliances">{page}</DashboardLayout>;
};
