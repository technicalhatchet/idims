import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import PortalInvoiceRow from './PortalInvoiceRow';
import { printPortalInvoicePdf } from '../../utils/portalInvoicePdf';

export default function InvoiceList({ invoices = [] }) {
  const hasOutstanding = invoices.some((inv) => inv.payment_status !== 'paid' && inv.status !== 'Paid');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="p-6 rounded-2xl bg-white/5 border border-white/10"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white">Invoices</h3>
        <Link href="/cxdashboard/invoices" className="text-cyan-400 text-sm hover:text-cyan-300">
          View All Invoices →
        </Link>
      </div>

      <div className="space-y-3">
        {invoices.map((invoice, i) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <PortalInvoiceRow
              invoice={invoice}
              compact
              onPrint={(inv) => printPortalInvoicePdf(inv.id).catch((e) => alert(e.message))}
            />
          </motion.div>
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
              View & Pay Invoices
              <FaArrowRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
