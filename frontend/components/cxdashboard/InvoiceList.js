import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import PortalInvoiceDocumentCard from './PortalInvoiceDocumentCard';
import InvoicePdfModal from './InvoicePdfModal';
import PortalInvoicePayModal from './PortalInvoicePayModal';

export default function InvoiceList({ invoices = [], portalToken = null, onInvoicesPaid }) {
  const [viewerInvoice, setViewerInvoice] = useState(null);
  const [viewerEstimate, setViewerEstimate] = useState(null);
  const [payInvoice, setPayInvoice] = useState(null);
  const hasOutstanding = invoices.some((inv) => inv.payment_status !== 'paid');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="p-4 md:p-6 rounded-2xl bg-white/5 border border-white/10"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white m-0">Invoices</h3>
        <Link href="/cxdashboard/invoices" className="text-cyan-400 text-sm hover:text-cyan-300">
          View All Invoices →
        </Link>
      </div>

      <div className="space-y-2.5">
        {invoices.map((invoice, i) => (
          <PortalInvoiceDocumentCard
            key={invoice.id}
            invoice={invoice}
            index={i}
            compact
            onView={setViewerInvoice}
            onViewEstimate={setViewerEstimate}
            onPay={portalToken ? setPayInvoice : undefined}
          />
        ))}
      </div>

      {hasOutstanding && (
        <div className="flex gap-3 mt-4">
          <Link href="/cxdashboard/invoices" className="flex-1">
            <button
              type="button"
              className="w-full py-2.5 rounded-xl text-white text-sm font-medium hover:shadow-[0_0_20px_rgba(251,146,60,0.4)] transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
            >
              View &amp; Pay Invoices
              <FaArrowRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      )}

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
            setPayInvoice(null);
            await onInvoicesPaid?.();
          }}
        />
      )}
    </motion.div>
  );
}
