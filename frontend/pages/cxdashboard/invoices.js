import { useState, useEffect } from 'react';
import Head from 'next/head';
import { FaFileInvoiceDollar } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import InvoicePdfModal from '../../components/cxdashboard/InvoicePdfModal';
import PortalInvoicePayModal from '../../components/cxdashboard/PortalInvoicePayModal';
import PortalInvoiceRow from '../../components/cxdashboard/PortalInvoiceRow';
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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [viewerInvoice, setViewerInvoice] = useState(null);
  const [viewerEstimate, setViewerEstimate] = useState(null);
  const [printingId, setPrintingId] = useState(null);
  const [payInvoice, setPayInvoice] = useState(null);
  const [portalToken, setPortalToken] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const token = session.accessToken;
        setPortalToken(token);
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

  async function reloadInvoices() {
    const sessionRes = await fetch('/api/auth/session');
    const session = await sessionRes.json();
    const token = session.accessToken;
    setPortalToken(token);
    const data = await portalFetch('invoices', token);
    setInvoices(Array.isArray(data) ? data : []);
  }

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

  const totalOutstanding = outstanding.reduce(
    (sum, i) => sum + Number(i.balance_due ?? (Number(i.total) - Number(i.amount_paid || 0))),
    0,
  );
  const anyCanPayOnline = outstanding.some((i) => i.can_pay_online && Number(i.balance_due) >= 1);

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
            {displayed.map((inv) => (
              <PortalInvoiceRow
                key={inv.id}
                invoice={inv}
                onView={setViewerInvoice}
                onViewEstimate={setViewerEstimate}
                onPay={setPayInvoice}
                onPrint={handlePrint}
                printing={printingId === inv.id}
              />
            ))}
          </div>
        )}

        {totalOutstanding > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '1.25rem', textAlign: 'center' }}>
            <p style={{ color: '#f59e0b', fontWeight: '600', margin: '0 0 0.75rem' }}>
              You have an outstanding balance of ${totalOutstanding.toFixed(2)}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: anyCanPayOnline ? '0 0 0.75rem' : 0 }}>
              {anyCanPayOnline
                ? 'Use Pay on an invoice below, or call us if you need help.'
                : 'Please contact Atomic Repair at (419) 794-1689 to arrange payment.'}
            </p>
            {anyCanPayOnline && (
              <button
                type="button"
                onClick={() => {
                  const next = outstanding.find((i) => i.can_pay_online && Number(i.balance_due) >= 1);
                  if (next) setPayInvoice(next);
                }}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#22c55e',
                  color: '#0a0f1a',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Pay outstanding balance
              </button>
            )}
          </div>
        )}
      </div>

      {viewerInvoice && (
        <InvoicePdfModal
          invoice={viewerInvoice}
          onClose={() => setViewerInvoice(null)}
        />
      )}

      {viewerEstimate && (
        <InvoicePdfModal
          invoice={viewerEstimate}
          docType="estimate"
          onClose={() => setViewerEstimate(null)}
        />
      )}

      {payInvoice && portalToken && (
        <PortalInvoicePayModal
          invoice={payInvoice}
          token={portalToken}
          onClose={() => setPayInvoice(null)}
          onSuccess={async () => {
            await reloadInvoices();
            setPayInvoice(null);
          }}
        />
      )}
    </>
  );
}

InvoicesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Invoices">{page}</DashboardLayout>;
};
