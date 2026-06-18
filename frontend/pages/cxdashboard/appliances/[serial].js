import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format, parseISO, isPast } from 'date-fns';
import { FaArrowLeft, FaShieldAlt, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import DashboardLayout from '../../../components/cxdashboard/DashboardLayout';
import ApplianceIcon from '../../../components/cxdashboard/ApplianceIcon';

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

const STATUS_STYLES = {
  completed: { label: 'Completed', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.2)' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  waiting_on_parts: { label: 'Waiting on Parts', bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: 'rgba(139,92,246,0.2)' },
  scheduled: { label: 'Scheduled', bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: 'rgba(34,211,238,0.2)' },
  pending: { label: 'Pending', bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
  canceled: { label: 'Canceled', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.2)' },
  completed_pending_payment: { label: 'Pending Payment', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  closed: { label: 'Closed', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.2)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status?.replace(/_/g, ' '), bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'rgba(255,255,255,0.1)' };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'capitalize' }}>
      {s.label}
    </span>
  );
}

function RepairHistoryItem({ repair }) {
  const [expanded, setExpanded] = useState(false);
  const warrantyExpiry = repair.warranty_expires ? parseISO(repair.warranty_expires) : null;
  const warrantyActive = warrantyExpiry && !isPast(warrantyExpiry);

  return (
    <div style={{
      background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px', overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: '0.75rem' }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem' }}>
              Order #{repair.order_number}
            </span>
            <StatusBadge status={repair.status} />
            {warrantyActive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '0.7rem', fontWeight: '600' }}>
                <FaShieldAlt style={{ fontSize: '9px' }} /> Warranty
              </span>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '4px 0 0' }}>
            {repair.created_at ? format(parseISO(repair.created_at), 'MMMM d, yyyy') : ''}
            {repair.invoice_total && (
              <span style={{ color: '#22d3ee', fontWeight: '600', marginLeft: '0.75rem' }}>
                ${Number(repair.invoice_total).toFixed(2)}
              </span>
            )}
          </p>
        </div>
        {expanded ? <FaChevronUp style={{ color: '#6b7280', flexShrink: 0 }} /> : <FaChevronDown style={{ color: '#6b7280', flexShrink: 0 }} />}
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {repair.description && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Issue</p>
              <p style={{ color: '#d1d5db', fontSize: '0.875rem' }}>{repair.description}</p>
            </div>
          )}

          {repair.symptoms?.length > 0 && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Symptoms</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {repair.symptoms.map((s, i) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {repair.parts?.length > 0 && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Parts Replaced</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {repair.parts.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: '#d1d5db' }}>{p.name || p.part_number}</span>
                    <span style={{ color: p.status === 'installed' ? '#22c55e' : '#f59e0b', textTransform: 'capitalize', fontSize: '0.75rem' }}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {warrantyExpiry && (
            <div style={{
              background: warrantyActive ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${warrantyActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '8px', padding: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <FaShieldAlt style={{ color: warrantyActive ? '#22c55e' : '#6b7280', fontSize: '12px' }} />
              <span style={{ color: warrantyActive ? '#22c55e' : '#6b7280', fontSize: '0.8125rem', fontWeight: '500' }}>
                {warrantyActive
                  ? `Labor warranty until ${format(warrantyExpiry, 'MMM d, yyyy')}`
                  : `Warranty expired ${format(warrantyExpiry, 'MMM d, yyyy')}`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplianceDetailPage() {
  const router = useRouter();
  const { serial } = router.query;
  const [appliance, setAppliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!serial) return;

    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const token = session.accessToken;
        const data = await portalFetch(`appliances/${encodeURIComponent(serial)}`, token);
        setAppliance(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [serial]);

  const displayName = appliance
    ? [appliance.make, appliance.subtype?.replace(/_/g, ' ')].filter(Boolean).join(' ') || appliance.type || 'Appliance'
    : 'Loading...';

  return (
    <>
      <Head><title>{displayName} | My Appliances | Atomic Repair</title></Head>
      <div className="space-y-6">
        <Link href="/cxdashboard/appliances" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }} className="hover:text-white">
          <FaArrowLeft style={{ fontSize: '12px' }} />
          Back to My Appliances
        </Link>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading appliance...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>{error}</div>
        ) : appliance ? (
          <>
            {/* Appliance Header */}
            <div style={{
              background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px', padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '12px', padding: '12px', flexShrink: 0 }}>
                  <ApplianceIcon type={appliance.subtype || appliance.type} className="w-10 h-10" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <h1 style={{ color: '#fff', fontSize: '1.375rem', fontWeight: '700', margin: 0, textTransform: 'capitalize' }}>
                        {displayName}
                      </h1>
                      {appliance.model && (
                        <p style={{ color: '#9ca3af', fontSize: '0.9375rem', margin: '2px 0 0' }}>
                          Model: {appliance.model}
                        </p>
                      )}
                    </div>
                    {appliance.warranty_active && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '6px 12px',
                        color: '#22c55e', fontSize: '0.8125rem', fontWeight: '600', flexShrink: 0,
                      }}>
                        <FaShieldAlt style={{ fontSize: '11px' }} /> Under Warranty
                      </span>
                    )}
                  </div>

                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem',
                    fontSize: '0.875rem', color: '#9ca3af',
                  }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 12px' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Serial Number</span>
                      <span style={{ color: '#d1d5db', fontFamily: 'monospace', fontWeight: '600' }}>{appliance.serial}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 12px' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Times Serviced</span>
                      <span style={{ color: '#22d3ee', fontWeight: '700', fontSize: '1.125rem' }}>{appliance.service_count}</span>
                    </div>
                    {appliance.property && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 12px' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block' }}>Location</span>
                        <span style={{ color: '#d1d5db' }}>
                          {appliance.property.address}{appliance.property.unit_number ? ` Unit ${appliance.property.unit_number}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Repair History */}
            <div>
              <h2 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                Service History
              </h2>
              {appliance.history?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {appliance.history.map(repair => (
                    <RepairHistoryItem key={repair.id} repair={repair} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#0D1525', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  No service history found
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

ApplianceDetailPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Appliance Details">{page}</DashboardLayout>;
};
