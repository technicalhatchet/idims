import { useState, useEffect } from 'react';
import Head from 'next/head';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { FaShieldAlt, FaPhone, FaEnvelope, FaTools, FaWrench } from 'react-icons/fa';
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

function WarrantyCard({ wo, expired }) {
  const warrantyExpiry = wo.warranty_expires ? parseISO(wo.warranty_expires) : null;
  const daysLeft = warrantyExpiry ? differenceInDays(warrantyExpiry, new Date()) : 0;
  const isExpired = expired || (warrantyExpiry && isPast(warrantyExpiry));

  const accentColor = isExpired ? '#6b7280' : daysLeft <= 14 ? '#f59e0b' : '#22c55e';
  const borderColor = isExpired ? 'rgba(255,255,255,0.07)' : daysLeft <= 14 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)';
  const bgColor = isExpired ? '#0D1525' : daysLeft <= 14 ? 'rgba(245,158,11,0.04)' : 'rgba(34,197,94,0.04)';

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem' }}>
      {/* Icon */}
      <div style={{ background: isExpired ? 'rgba(255,255,255,0.04)' : `${accentColor}18`, borderRadius: '10px', padding: '10px', flexShrink: 0, alignSelf: 'flex-start' }}>
        <ApplianceIcon type={wo.equipment_subtype || wo.equipment_type} className="w-7 h-7" color={isExpired ? 'cyan' : daysLeft <= 14 ? 'orange' : 'cyan'} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div>
            <p style={{ color: '#fff', fontWeight: '700', fontSize: '1rem', margin: 0 }}>
              {[wo.equipment_make, wo.equipment_model].filter(Boolean).join(' ') || [wo.equipment_make, wo.equipment_subtype].filter(Boolean).join(' ') || 'Appliance Service'}
            </p>
            {wo.equipment_serial && (
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '2px 0 0' }}>S/N: {wo.equipment_serial}</p>
            )}
          </div>

          {/* Warranty status badge */}
          <div style={{ textAlign: 'right' }}>
            {isExpired ? (
              <span style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaShieldAlt style={{ fontSize: '10px' }} /> Expired
              </span>
            ) : daysLeft <= 14 ? (
              <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaShieldAlt style={{ fontSize: '10px' }} /> Expires in {daysLeft}d
              </span>
            ) : (
              <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaShieldAlt style={{ fontSize: '10px' }} /> Active — {daysLeft} days left
              </span>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Service Date</p>
            <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: 0 }}>
              {wo.created_at ? format(parseISO(wo.created_at), 'MMM d, yyyy') : 'N/A'}
            </p>
          </div>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Labor Warranty</p>
            <p style={{ color: isExpired ? '#6b7280' : accentColor, fontSize: '0.875rem', margin: 0, fontWeight: '600' }}>
              {warrantyExpiry ? `Until ${format(warrantyExpiry, 'MMM d, yyyy')}` : 'N/A'}
            </p>
          </div>
          {wo.property && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Location</p>
              <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: 0 }}>
                {wo.property.address}{wo.property.unit_number ? ` Unit ${wo.property.unit_number}` : ''}
              </p>
            </div>
          )}
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Order</p>
            <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: 0 }}>#{wo.order_number}</p>
          </div>
        </div>

        {/* Parts installed */}
        {wo.parts?.filter(p => p.status === 'installed').length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FaWrench style={{ fontSize: '10px' }} /> Parts Installed
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {wo.parts.filter(p => p.status === 'installed').map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#d1d5db' }}>{p.name || p.part_number || 'Part'}</span>
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Manufacturer warranty may apply</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Claim warranty CTA — only for active */}
        {!isExpired && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href="tel:4197941689" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8125rem', fontWeight: '600', textDecoration: 'none' }}>
              <FaPhone style={{ fontSize: '11px' }} /> (419) 794-1689
            </a>
            <a href="mailto:service@atomicrepair419.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8125rem', fontWeight: '600', textDecoration: 'none' }}>
              <FaEnvelope style={{ fontSize: '11px' }} /> Email Us
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WarrantyPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('active');

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const token = session.accessToken;
        // Fetch completed work orders only
        const data = await portalFetch('work-orders', token);
        setWorkOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // All completed WOs get a warranty_expires 90 days out
  // Add it client-side for ones that don't have it from backend
  const withWarranty = workOrders.map(wo => {
    if (!wo.warranty_expires && wo.created_at) {
      const expiry = new Date(parseISO(wo.created_at));
      expiry.setDate(expiry.getDate() + 90);
      return { ...wo, warranty_expires: expiry.toISOString() };
    }
    return wo;
  });

  const active = withWarranty.filter(wo => {
    if (!wo.warranty_expires) return false;
    return !isPast(parseISO(wo.warranty_expires));
  });

  const expired = withWarranty.filter(wo => {
    if (!wo.warranty_expires) return true;
    return isPast(parseISO(wo.warranty_expires));
  });

  const displayed = tab === 'active' ? active : expired;

  return (
    <>
      <Head><title>Warranty Coverage | Atomic Repair</title></Head>
      <div className="space-y-6">
        <div>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', margin: '0 0 0.25rem' }}>Warranty Coverage</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            All repairs include a 90-day labor warranty from the service date. Parts carry manufacturer warranty.
          </p>
        </div>

        {/* Summary */}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ background: active.length > 0 ? 'rgba(34,197,94,0.06)' : '#0D1525', border: `1px solid ${active.length > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', padding: '1.25rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaShieldAlt style={{ color: '#22c55e' }} /> Active Warranties
              </p>
              <p style={{ color: active.length > 0 ? '#22c55e' : '#fff', fontSize: '1.75rem', fontWeight: '700', margin: 0 }}>{active.length}</p>
            </div>
            <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.25rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaTools style={{ color: '#6b7280' }} /> Total Services
              </p>
              <p style={{ color: '#fff', fontSize: '1.75rem', fontWeight: '700', margin: 0 }}>{workOrders.length}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { key: 'active', label: `Active (${active.length})` },
            { key: 'expired', label: `Expired (${expired.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '0.625rem 1.25rem', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #22d3ee' : '2px solid transparent', color: tab === t.key ? '#22d3ee' : '#6b7280', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '-1px' }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading warranty info...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>{error}</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <FaShieldAlt style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }} />
            <p>{tab === 'active' ? 'No active warranties' : 'No expired warranties'}</p>
            {tab === 'active' && <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Warranties are valid for 90 days from service completion.</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayed.map(wo => <WarrantyCard key={wo.id} wo={wo} expired={tab === 'expired'} />)}
          </div>
        )}

        {/* Fine print */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
          <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: 0, lineHeight: '1.6' }}>
            <strong style={{ color: '#9ca3af' }}>Warranty Terms:</strong> Labor warranty covers the original repair only and is void if the appliance has been serviced by another technician, subjected to misuse, or damaged by external factors. Parts carry their respective manufacturer warranties. To file a warranty claim, contact Atomic Repair within the warranty period.
          </p>
        </div>
      </div>
    </>
  );
}

WarrantyPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Warranty">{page}</DashboardLayout>;
};
