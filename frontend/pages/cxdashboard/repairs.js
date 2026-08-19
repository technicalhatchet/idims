import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { format, parseISO, addDays, isPast } from 'date-fns';
import { FaTools, FaShieldAlt, FaChevronDown, FaChevronUp, FaFileAlt } from 'react-icons/fa';
import { formatPortalWorkOrderAppliance } from '../../utils/portalWorkOrderDisplay';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import ApplianceIcon from '../../components/cxdashboard/ApplianceIcon';
import InvoicePdfModal from '../../components/cxdashboard/InvoicePdfModal';

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
  parts_on_order: { label: 'Parts on Order', bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
  scheduled: { label: 'Scheduled', bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: 'rgba(34,211,238,0.2)' },
  pending: { label: 'Pending', bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'rgba(255,255,255,0.1)' },
  canceled: { label: 'Canceled', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.2)' },
  completed_pending_payment: { label: 'Pending Payment', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status?.replace(/_/g, ' '), bg: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: 'rgba(255,255,255,0.1)' };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'capitalize' }}>
      {s.label}
    </span>
  );
}

function RepairCard({ wo, onViewEstimate, initialExpanded = false }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const cardRef = useRef(null);
  const warrantyExpiry = wo.warranty_expires ? parseISO(wo.warranty_expires) : null;
  const warrantyActive = warrantyExpiry && !isPast(warrantyExpiry);

  useEffect(() => {
    if (initialExpanded) {
      setExpanded(true);
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [initialExpanded]);

  return (
    <div ref={cardRef} style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', cursor: 'pointer' }}
      >
        <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
          <ApplianceIcon type={wo.equipment_subtype || wo.equipment_type} className="w-7 h-7" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <p style={{ color: '#fff', fontWeight: '600', margin: 0 }}>
                {formatPortalWorkOrderAppliance(wo) || 'Service'}
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '2px 0 0' }}>
                Order #{wo.order_number}
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '2px 0 0' }}>
                {wo.created_at ? format(parseISO(wo.created_at), 'MMM d, yyyy') : ''}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusBadge status={wo.status} />
              {warrantyActive && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '0.75rem', fontWeight: '600' }}>
                  <FaShieldAlt style={{ fontSize: '10px' }} />
                  Warranty
                </span>
              )}
              {expanded ? <FaChevronUp style={{ color: '#6b7280' }} /> : <FaChevronDown style={{ color: '#6b7280' }} />}
            </div>
          </div>

          {wo.invoice_total && (
            <p style={{ color: '#22d3ee', fontWeight: '700', fontSize: '1rem', margin: '0.5rem 0 0' }}>
              ${Number(wo.invoice_total).toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {wo.description && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Issue Description</p>
              <p style={{ color: '#d1d5db', fontSize: '0.875rem' }}>{wo.description}</p>
            </div>
          )}

          {wo.symptoms?.length > 0 && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Reported Symptoms</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {wo.symptoms.map((s, i) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {wo.parts?.length > 0 && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Parts</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {wo.parts.map((p, i) => {
                  const partStatus = p.status || '';
                  const statusColor = partStatus === 'installed'
                    ? '#22c55e'
                    : partStatus === 'received'
                      ? '#34d399'
                      : partStatus === 'ordered'
                        ? '#fbbf24'
                        : '#f59e0b';
                  return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: '#d1d5db' }}>{p.name || p.part_number}</span>
                    <span style={{ color: statusColor, textTransform: 'capitalize' }}>{partStatus.replace(/_/g, ' ')}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {warrantyExpiry && (
            <div style={{ background: warrantyActive ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${warrantyActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaShieldAlt style={{ color: warrantyActive ? '#22c55e' : '#6b7280' }} />
              <span style={{ color: warrantyActive ? '#22c55e' : '#6b7280', fontSize: '0.8125rem', fontWeight: '600' }}>
                {warrantyActive ? `Warranty active until ${format(warrantyExpiry, 'MMM d, yyyy')}` : `Warranty expired ${format(warrantyExpiry, 'MMM d, yyyy')}`}
              </span>
            </div>
          )}

          {wo.property && (
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Service Location</p>
              <p style={{ color: '#d1d5db', fontSize: '0.875rem' }}>{wo.property.address}{wo.property.unit_number ? ` Unit ${wo.property.unit_number}` : ''}</p>
            </div>
          )}

          {wo.estimate_available && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onViewEstimate?.(wo); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(139,92,246,0.12)', color: '#c4b5fd',
                  border: '1px solid rgba(139,92,246,0.25)', borderRadius: '8px',
                  padding: '8px 14px', fontSize: '0.8125rem', fontWeight: '600', cursor: 'pointer',
                }}
              >
                <FaFileAlt style={{ fontSize: '12px' }} />
                View Estimate
              </button>
              {wo.estimate_expires_at && (
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  Valid through {format(parseISO(wo.estimate_expires_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RepairsPage() {
  const router = useRouter();
  const orderParam = typeof router.query.order === 'string' ? router.query.order : null;
  const workOrderIdParam = typeof router.query.work_order === 'string' ? router.query.work_order : null;
  const highlightKey = orderParam || workOrderIdParam;
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('active');
  const [viewerEstimate, setViewerEstimate] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const token = session.accessToken;
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

  useEffect(() => {
    if (!highlightKey || workOrders.length === 0) return;
    const match = workOrders.find(
      (w) => w.order_number === highlightKey || w.id === highlightKey
    );
    if (!match) return;
    const isCompleted = ['completed', 'closed'].includes(match.status);
    setTab(isCompleted ? 'completed' : 'active');
  }, [highlightKey, workOrders]);

  const active = workOrders.filter(w => !['completed', 'canceled', 'closed'].includes(w.status));
  const completed = workOrders.filter(w => ['completed', 'closed'].includes(w.status));
  const displayed = tab === 'active' ? active : completed;

  return (
    <>
      <Head><title>My Repairs | Atomic Repair</title></Head>
      <div className="space-y-6">
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>My Repairs</h1>

        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {['active', 'completed'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '0.625rem 1.25rem', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #22d3ee' : '2px solid transparent', color: tab === t ? '#22d3ee' : '#6b7280', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', textTransform: 'capitalize', marginBottom: '-1px' }}>
              {t === 'active' ? `Active (${active.length})` : `Completed (${completed.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading repairs...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>{error}</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <FaTools style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }} />
            <p>No {tab} repairs</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayed.map(wo => (
              <RepairCard
                key={wo.id}
                wo={wo}
                onViewEstimate={setViewerEstimate}
                initialExpanded={Boolean(
                  highlightKey && (wo.order_number === highlightKey || wo.id === highlightKey)
                )}
              />
            ))}
          </div>
        )}
      </div>

      {viewerEstimate && (
        <InvoicePdfModal
          invoice={viewerEstimate}
          docType="estimate"
          onClose={() => setViewerEstimate(null)}
        />
      )}
    </>
  );
}

RepairsPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="My Repairs">{page}</DashboardLayout>;
};
