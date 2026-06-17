import { useState, useEffect } from 'react';
import Head from 'next/head';
import { format, parseISO } from 'date-fns';
import { FaFileInvoiceDollar, FaCheckCircle, FaExclamationCircle, FaPrint } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import InvoicePdfModal from '../../components/cxdashboard/InvoicePdfModal';
import InvoiceDownloadMenu from '../../components/cxdashboard/InvoiceDownloadMenu';
import { printPortalInvoicePdf } from '../../utils/portalInvoicePdf';

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
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Portal API error: ${res.status}`);
  return res.json();
}

function PaymentBadge({ status }) {
  const styles = {
    paid: { label: 'Paid', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.2)', icon: FaCheckCircle },
    partial: { label: 'Partial', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)', icon: FaExclamationCircle },
    unpaid: { label: 'Outstanding', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.2)', icon: FaExclamationCircle },
  };
  const s = styles[status] || styles.unpaid;
  const Icon = s.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: '600' }}>
      <Icon style={{ fontSize: '10px' }} />{s.label}
    </span>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [viewerInvoice, setViewerInvoice] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const token = session.accessToken;
        const data = await portalFetch('invoices', token);
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handlePrint(inv) {
    setPrintingId(inv.id);
    try {
      await printPortalInvoicePdf(inv.id);
    } catch (e) {
      alert(`Print failed: ${e.message}`);
    } finally {
      setPrintingId(null);
    }
  }

  const outstanding = invoices.filter(i => i.payment_status !== 'paid');
  const paid = invoices.filter(i => i.payment_status === 'paid');
  const displayed = tab === 'all' ? invoices : tab === 'outstanding' ? outstanding : paid;

  const totalOutstanding = outstanding.reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid || 0)), 0);

  return (
    <>
      <Head><title>Invoices | Atomic Repair</title></Head>
      <div className="space-y-6">
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Invoices & Payments</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>Total Invoices</p>
            <p style={{ color: '#fff', fontSize: '1.75rem', fontWeight: '700', margin: 0 }}>{invoices.length}</p>
          </div>
          <div style={{ background: '#0D1525', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>Outstanding Balance</p>
            <p style={{ color: totalOutstanding > 0 ? '#ef4444' : '#22c55e', fontSize: '1.75rem', fontWeight: '700', margin: 0 }}>
              ${totalOutstanding.toFixed(2)}
            </p>
          </div>
          <div style={{ background: '#0D1525', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>Total Paid</p>
            <p style={{ color: '#22c55e', fontSize: '1.75rem', fontWeight: '700', margin: 0 }}>
              ${paid.reduce((sum, i) => sum + Number(i.total || 0), 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { key: 'all', label: `All (${invoices.length})` },
            { key: 'outstanding', label: `Outstanding (${outstanding.length})` },
            { key: 'paid', label: `Paid (${paid.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '0.625rem 1.25rem', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #22d3ee' : '2px solid transparent', color: tab === t.key ? '#22d3ee' : '#6b7280', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '-1px' }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading invoices...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>{error}</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <FaFileInvoiceDollar style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }} />
            <p>No invoices found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayed.map(inv => (
              <div key={inv.id} style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
                  <FaFileInvoiceDollar style={{ color: '#22d3ee', fontSize: '1.25rem' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <p
                        onClick={() => setViewerInvoice(inv)}
                        style={{ color: '#22d3ee', fontWeight: '600', margin: 0, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(34,211,238,0.3)' }}
                      >
                        Invoice #{inv.order_number}
                      </p>
                      <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '2px 0 0' }}>
                        {inv.created_at ? format(parseISO(inv.created_at), 'MMM d, yyyy') : ''}
                        {inv.equipment_make && ` • ${inv.equipment_make}`}
                        {inv.equipment_subtype && ` ${inv.equipment_subtype}`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ color: '#fff', fontWeight: '700', fontSize: '1.125rem', margin: '0 0 4px' }}>
                        ${Number(inv.total || 0).toFixed(2)}
                      </p>
                      <PaymentBadge status={inv.payment_status} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
                        <button
                          type="button"
                          title="Print invoice (light)"
                          disabled={printingId === inv.id}
                          onClick={() => handlePrint(inv)}
                          style={{
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px', cursor: printingId === inv.id ? 'wait' : 'pointer',
                          }}
                        >
                          <FaPrint style={{ fontSize: '13px' }} />
                        </button>
                        <InvoiceDownloadMenu invoice={inv} />
                      </div>
                    </div>
                  </div>

                  {inv.payment_status === 'partial' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>
                        <span>Paid: ${Number(inv.amount_paid || 0).toFixed(2)}</span>
                        <span>Remaining: ${(Number(inv.total) - Number(inv.amount_paid || 0)).toFixed(2)}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                        <div style={{ background: '#22d3ee', height: '100%', width: `${Math.min(100, (Number(inv.amount_paid) / Number(inv.total)) * 100)}%`, borderRadius: '999px' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalOutstanding > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center' }}>
            <p style={{ color: '#f59e0b', fontWeight: '600', margin: '0 0 0.75rem' }}>
              You have an outstanding balance of ${totalOutstanding.toFixed(2)}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
              Please contact Atomic Repair at (419) 794-1689 to arrange payment.
            </p>
          </div>
        )}
      </div>

      {viewerInvoice && (
        <InvoicePdfModal
          invoice={viewerInvoice}
          onClose={() => setViewerInvoice(null)}
        />
      )}
    </>
  );
}

InvoicesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Invoices">{page}</DashboardLayout>;
};
