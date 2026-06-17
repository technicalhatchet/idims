import { useState, useEffect } from 'react';
import Head from 'next/head';
import { format, parseISO, isPast, isFuture } from 'date-fns';
import { FaCalendarAlt, FaMapMarkerAlt, FaPhone, FaClock } from 'react-icons/fa';
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

const STATUS_STYLES = {
  scheduled: { label: 'Scheduled', bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: 'rgba(34,211,238,0.2)' },
  confirmed: { label: 'Confirmed', bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: 'rgba(34,211,238,0.2)' },
  en_route: { label: 'En Route', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  in_progress: { label: 'In Progress', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  completed: { label: 'Completed', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.2)' },
  canceled: { label: 'Canceled', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.2)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status, bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'rgba(255,255,255,0.1)' };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: '600' }}>
      {s.label}
    </span>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const token = session.accessToken;
        const data = await portalFetch('appointments', token);
        setAppointments(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const upcoming = appointments.filter(a => {
    if (!a.scheduled_start) return false;
    return isFuture(parseISO(a.scheduled_start)) && a.status !== 'canceled';
  });

  const past = appointments.filter(a => {
    if (!a.scheduled_start) return false;
    return isPast(parseISO(a.scheduled_start)) || a.status === 'canceled' || a.status === 'completed';
  });

  const displayed = tab === 'upcoming' ? upcoming : past;

  return (
    <>
      <Head><title>My Appointments | Atomic Repair</title></Head>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>My Appointments</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
          {['upcoming', 'past'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #22d3ee' : '2px solid transparent',
                color: tab === t ? '#22d3ee' : '#6b7280',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                marginBottom: '-1px',
              }}
            >
              {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading appointments...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>{error}</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <FaCalendarAlt style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }} />
            <p>No {tab} appointments</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayed.map(appt => {
              const wo = appt.work_order || {};
              const prop = appt.property || {};
              const start = appt.scheduled_start ? parseISO(appt.scheduled_start) : null;
              const end = appt.scheduled_end ? parseISO(appt.scheduled_end) : null;

              return (
                <div key={appt.id} style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {/* Icon */}
                  <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
                    <ApplianceIcon type={wo.equipment_subtype || wo.equipment_type} className="w-7 h-7" />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <p style={{ color: '#fff', fontWeight: '600', margin: 0 }}>
                          {[wo.equipment_make, wo.equipment_subtype].filter(Boolean).join(' ') || wo.equipment_type || 'Service'}
                        </p>
                        <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '2px 0 0' }}>
                          Order #{wo.order_number}
                        </p>
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
                      {start && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FaCalendarAlt style={{ color: '#22d3ee', flexShrink: 0 }} />
                          {format(start, 'EEE, MMM d, yyyy')}
                        </span>
                      )}
                      {start && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FaClock style={{ color: '#22d3ee', flexShrink: 0 }} />
                          {format(start, 'h:mm a')}{end ? ` – ${format(end, 'h:mm a')}` : ''}
                        </span>
                      )}
                      {prop.address && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FaMapMarkerAlt style={{ color: '#22d3ee', flexShrink: 0 }} />
                          {prop.address}{prop.unit_number ? ` Unit ${prop.unit_number}` : ''}
                        </span>
                      )}
                    </div>

                    {prop.tenant_name && (
                      <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        Tenant: {prop.tenant_name}
                        {prop.tenant_phone && (
                          <a href={`tel:${prop.tenant_phone}`} style={{ color: '#22d3ee', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <FaPhone style={{ fontSize: '10px' }} />{prop.tenant_phone}
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

AppointmentsPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="My Appointments">{page}</DashboardLayout>;
};
