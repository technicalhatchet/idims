import { useState, useEffect } from 'react';
import Head from 'next/head';
import { FaFileInvoiceDollar } from 'react-icons/fa';
import DashboardLayout from '../../components/cxdashboard/DashboardLayout';
import InvoicePdfModal from '../../components/cxdashboard/InvoicePdfModal';
import PortalInvoicePayModal from '../../components/cxdashboard/PortalInvoicePayModal';
import PortalInvoicePayAllModal from '../../components/cxdashboard/PortalInvoicePayAllModal';
import PortalInvoiceDocumentCard from '../../components/cxdashboard/PortalInvoiceDocumentCard';
import SupportCTA from '../../components/cxdashboard/SupportCTA';
import {
  getPortalPayableInvoices,
  sumPortalInvoicesAmountPaid,
} from '../../utils/portalWorkOrderDisplay';

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
  const [payInvoice, setPayInvoice] = useState(null);
  const [payAllOpen, setPayAllOpen] = useState(false);
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

  const outstanding = invoices.filter((i) => i.payment_status !== 'paid');
  const paid = invoices.filter((i) => i.payment_status === 'paid');
  const displayed = tab === 'all' ? invoices : tab === 'outstanding' ? outstanding : paid;
  const payableInvoices = getPortalPayableInvoices(invoices);

  const totalOutstanding = outstanding.reduce(
    (sum, i) => sum + Number(i.balance_due ?? (Number(i.total) - Number(i.amount_paid || 0))),
    0,
  );
  const totalPaid = sumPortalInvoicesAmountPaid(invoices);

  return (
    <>
      <Head><title>Invoices | Atomic Repair</title></Head>
      <div className="space-y-5 md:space-y-6">
        <div>
          <h1 className="text-white text-2xl font-bold m-0">Invoices &amp; Payments</h1>
          <p className="text-white/45 text-sm mt-1 mb-0">Your invoices and payment history</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/[0.07] bg-[#0D1525] px-4 py-3">
            <p className="text-white/45 text-xs m-0 mb-1">Total Invoices</p>
            <p className="text-white text-2xl font-bold m-0 tabular-nums">{invoices.length}</p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-[#0D1525] px-4 py-3">
            <p className="text-white/45 text-xs m-0 mb-1">Outstanding Balance</p>
            <p className={`text-2xl font-bold m-0 tabular-nums ${totalOutstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              ${totalOutstanding.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-[#0D1525] px-4 py-3">
            <p className="text-white/45 text-xs m-0 mb-1">Total Paid</p>
            <p className="text-emerald-400 text-2xl font-bold m-0 tabular-nums">
              ${totalPaid.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-white/[0.08]">
          {[
            { key: 'all', label: `All (${invoices.length})` },
            { key: 'outstanding', label: `Outstanding (${outstanding.length})` },
            { key: 'paid', label: `Paid (${paid.length})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 bg-transparent border-0 border-b-2 -mb-px text-sm font-semibold cursor-pointer transition-colors ${
                tab === t.key
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-white/45 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-white/45">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading invoices...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-white/45">
            <FaFileInvoiceDollar className="text-4xl mx-auto mb-4 opacity-30" />
            <p className="m-0">No invoices found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {displayed.map((inv, index) => (
              <PortalInvoiceDocumentCard
                key={inv.id}
                invoice={inv}
                index={index}
                onView={setViewerInvoice}
                onViewEstimate={setViewerEstimate}
                onPay={setPayInvoice}
              />
            ))}
          </div>
        )}

        {payableInvoices.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-amber-400 font-semibold text-sm m-0">
                  {payableInvoices.length} invoice{payableInvoices.length === 1 ? '' : 's'} ready to pay online
                </p>
                <p className="text-white/50 text-xs mt-1 m-0">
                  Total outstanding: ${totalOutstanding.toFixed(2)}
                  {payableInvoices.length > 1 && (
                    <> — pay all in one transaction ({payableInvoices.map((i) => i.order_number).join(', ')})</>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayAllOpen(true)}
                className="shrink-0 px-5 py-2.5 rounded-lg bg-emerald-500 text-[#0a0f1a] font-bold text-sm hover:bg-emerald-400 transition-colors"
              >
                Pay all (${payableInvoices.reduce((s, i) => s + Number(i.balance_due), 0).toFixed(2)})
              </button>
            </div>
          </div>
        )}

        {totalOutstanding > 0 && payableInvoices.length === 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4 text-center">
            <p className="text-amber-400 font-semibold text-sm m-0">
              Outstanding balance: ${totalOutstanding.toFixed(2)}
            </p>
            <p className="text-white/50 text-xs mt-1 m-0">
              Please contact Atomic Repair at (419) 794-1689 to arrange payment.
            </p>
          </div>
        )}

        <SupportCTA variant="invoices" />
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

      {payAllOpen && portalToken && (
        <PortalInvoicePayAllModal
          invoices={invoices}
          token={portalToken}
          onClose={() => setPayAllOpen(false)}
          onSuccess={async () => {
            await reloadInvoices();
            setPayAllOpen(false);
          }}
        />
      )}
    </>
  );
}

InvoicesPage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Invoices">{page}</DashboardLayout>;
};
