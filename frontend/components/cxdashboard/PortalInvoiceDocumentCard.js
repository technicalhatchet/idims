import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaCalendarAlt,
  FaFileAlt,
} from 'react-icons/fa';
import {
  formatPortalWorkOrderAppliance,
  getPortalInvoicePaymentSummary,
  getPortalInvoiceDisplayStatus,
} from '../../utils/portalWorkOrderDisplay';

const STATUS_CONFIG = {
  paid: {
    label: 'PAID',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Icon: FaCheckCircle,
  },
  partial: {
    label: 'PARTIALLY PAID',
    shortLabel: 'PARTIAL',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Icon: FaClock,
  },
  outstanding: {
    label: 'OUTSTANDING',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    Icon: FaExclamationCircle,
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.outstanding;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wide border rounded leading-none ${cfg.badgeClass}`}
    >
      <Icon className="w-2.5 h-2.5 shrink-0 block" aria-hidden />
      <span className="truncate leading-none sm:hidden">{cfg.shortLabel || cfg.label}</span>
      <span className="truncate leading-none hidden sm:inline">{cfg.label}</span>
    </span>
  );
}

function InvoiceIcon({ compact }) {
  return (
    <FaFileInvoiceDollar
      className={`${compact ? 'w-6 h-6' : 'w-7 h-7 sm:w-8 sm:h-8'} text-cyan-400 shrink-0 mt-0.5`}
      aria-hidden
    />
  );
}

function AmountDisplay({ summary, status }) {
  const total = summary.total || summary.paid + summary.balance;

  if (status === 'paid') {
    return (
      <p className="text-lg sm:text-[1.375rem] font-bold text-white tabular-nums leading-none text-right pt-1">
        ${summary.paid.toFixed(2)}
      </p>
    );
  }

  if (status === 'partial') {
    const pct = total > 0 ? Math.min(100, (summary.paid / total) * 100) : 0;
    return (
      <div className="w-full text-right min-w-0 pt-1">
        <p className="text-sm sm:text-[1.125rem] font-bold text-white tabular-nums leading-tight">
          <span>${summary.balance.toFixed(2)}</span>
          <span className="text-white/35 font-medium text-[11px] sm:text-sm mx-0.5 sm:mx-1">of</span>
          <span className="text-white/60 font-semibold text-[11px] sm:text-sm">${total.toFixed(2)}</span>
        </p>
        <div
          className="h-1 rounded-full bg-white/[0.08] overflow-hidden mt-1.5 ml-auto w-full max-w-[140px] sm:max-w-[180px]"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`$${summary.paid.toFixed(2)} paid of $${total.toFixed(2)} total, $${summary.balance.toFixed(2)} remaining`}
        >
          <motion.div
            className="h-full bg-cyan-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  return (
    <p className="text-lg sm:text-[1.375rem] font-bold text-white tabular-nums leading-none text-right min-w-0 pt-1">
      ${summary.balance.toFixed(2)}
    </p>
  );
}


export default function PortalInvoiceDocumentCard({
  invoice,
  onView,
  onViewEstimate,
  onPay,
  compact = false,
  index = 0,
}) {
  const summary = getPortalInvoicePaymentSummary(invoice);
  const status = getPortalInvoiceDisplayStatus(invoice);
  const applianceLine = formatPortalWorkOrderAppliance(invoice);
  const dateLine = invoice.created_at
    ? format(parseISO(invoice.created_at), 'MMM d, yyyy')
    : '';
  const isOutstanding = status === 'outstanding';
  const canPay = invoice.can_pay_online && Number(invoice.balance_due) >= 1 && onPay;
  const pad = compact ? 'px-2.5 py-2.5 sm:px-3 sm:py-3' : 'px-3 py-3 sm:px-4 sm:py-3.5';

  const handleCardClick = () => onView?.(invoice);
  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && onView) {
      e.preventDefault();
      onView(invoice);
    }
  };

  const ariaLabel = [
    `Invoice ${invoice.order_number}`,
    STATUS_CONFIG[status]?.label,
    status === 'paid'
      ? `$${summary.paid.toFixed(2)} paid`
      : `$${summary.balance.toFixed(2)} balance due`,
    applianceLine,
    dateLine,
  ].filter(Boolean).join(', ');

  const openInvoice = (e) => {
    e.stopPropagation();
    onView?.(invoice);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={[
        'group relative rounded-lg border bg-[#0D1525] overflow-hidden transition-colors max-w-full',
        'hover:border-cyan-500/25 hover:bg-[#0f1828]',
        isOutstanding ? 'border-red-500/20 border-l-2 border-l-red-500/70' : 'border-white/[0.07]',
        onView ? 'cursor-pointer' : '',
      ].join(' ')}
      onClick={onView ? handleCardClick : undefined}
      onKeyDown={onView ? handleKeyDown : undefined}
      role={onView ? 'button' : undefined}
      tabIndex={onView ? 0 : undefined}
      aria-label={onView ? ariaLabel : undefined}
    >
      <div
        className={`grid grid-cols-[minmax(0,1.55fr)_minmax(96px,0.9fr)] sm:grid-cols-[minmax(0,1.62fr)_minmax(148px,0.88fr)] ${pad} gap-x-3 sm:gap-x-5 items-stretch max-w-full`}
      >
        {/* Left — invoice details */}
        <div className="flex gap-2 sm:gap-3 min-w-0">
          <InvoiceIcon compact={compact} />
          <div className="flex flex-col justify-between min-w-0 flex-1 gap-1.5 sm:gap-2">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-semibold tracking-[0.12em] sm:tracking-[0.14em] text-orange-400 uppercase leading-none">
                Invoice
              </p>
              <p className="text-[15px] sm:text-[1.125rem] font-bold text-cyan-400 truncate leading-tight mt-0.5 sm:mt-1">
                {invoice.order_number}
              </p>
              <p className="text-xs sm:text-[13px] text-white/75 mt-0.5 truncate leading-snug">
                {applianceLine}
              </p>
            </div>
            {dateLine && (
              <p className="flex items-center gap-1 text-[10px] sm:text-[11px] text-white/42 leading-none">
                <FaCalendarAlt className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" aria-hidden />
                <time dateTime={invoice.created_at} className="truncate">{dateLine}</time>
              </p>
            )}
          </div>
        </div>

        {/* Right — status, amount, actions */}
        <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_1fr_auto] w-full min-w-0 min-h-[72px] sm:min-h-[76px] py-0.5">
          <div className="col-start-2 row-start-1 flex flex-col items-end">
            <StatusBadge status={status} />
          </div>

          <div className="col-start-2 row-start-2 flex flex-col justify-center items-end self-stretch">
            <AmountDisplay summary={summary} status={status} />
          </div>

          <div
            className="col-start-2 row-start-3 flex flex-col items-end gap-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {(status === 'paid' || status === 'outstanding') && (
              <div className="w-full border-t border-white/[0.06] mb-0.5" aria-hidden />
            )}
            {canPay && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPay(invoice);
                }}
                aria-label={`Pay invoice ${invoice.order_number}, $${Number(invoice.balance_due).toFixed(2)} due`}
                className="h-7 px-3 text-[11px] sm:text-xs font-bold rounded-md bg-emerald-500 text-[#0a0f1a] hover:bg-emerald-400 transition-colors shadow-sm"
              >
                Pay
              </button>
            )}
            <button
              type="button"
              onClick={openInvoice}
              className="text-[10px] sm:text-xs font-medium text-white/45 hover:text-cyan-400/80 transition-colors whitespace-nowrap"
            >
              View Invoice →
            </button>
            {!compact && invoice.estimate_available && onViewEstimate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewEstimate(invoice);
                }}
                className="h-6 px-1.5 sm:px-2 inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold rounded border border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors"
              >
                <FaFileAlt className="w-2.5 h-2.5 shrink-0" aria-hidden />
                Estimate
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
