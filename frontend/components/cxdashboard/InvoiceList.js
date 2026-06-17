import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaFileInvoice, FaPrint, FaArrowRight } from 'react-icons/fa';
import InvoiceDownloadMenu from './InvoiceDownloadMenu';
import { printPortalInvoicePdf } from '../../utils/portalInvoicePdf';

const SAMPLE_INVOICES = [
  {
    id: 'INV-1023',
    date: 'May 10, 2025',
    status: 'Paid',
    amount: '$245.00',
    dueDate: null
  },
  {
    id: 'INV-1022',
    date: 'Apr 25, 2025',
    status: 'Paid',
    amount: '$185.00',
    dueDate: null
  },
  {
    id: 'INV-1021',
    date: 'May 18, 2025',
    status: 'Due',
    amount: '$120.00',
    dueDate: 'May 28, 2025'
  }
];

export default function InvoiceList({ invoices = SAMPLE_INVOICES }) {
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
            className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <FaFileInvoice className="w-5 h-5 text-cyan-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">Invoice #{invoice.number || invoice.id}</p>
              <p className="text-gray-400 text-xs">{invoice.date}</p>
            </div>

            <div className="text-right flex items-center gap-3">
              <div>
                <span className={`text-xs font-medium ${
                  invoice.status === 'Paid' ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {invoice.status === 'Paid' ? 'Paid' : `Due ${invoice.dueDate}`}
                </span>
                <p className="text-white font-semibold">{invoice.amount}</p>
              </div>
              <button
                type="button"
                title="Print invoice (light)"
                onClick={() => printPortalInvoicePdf(invoice.id).catch(e => alert(e.message))}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-white/10 transition-colors"
              >
                <FaPrint className="w-3 h-3" />
              </button>
              <InvoiceDownloadMenu invoice={invoice} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        {invoices.some(inv => inv.status === 'Due') && (
          <Link href="/cxdashboard/invoices/pay" className="flex-1">
            <button className="w-full py-2.5 rounded-xl text-white text-sm font-medium hover:shadow-[0_0_20px_rgba(251,146,60,0.4)] transition-all flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}>
              Make a Payment
              <FaArrowRight className="w-3 h-3" />
            </button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}
