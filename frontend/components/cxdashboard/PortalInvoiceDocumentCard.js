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
      className={`inline-flex items-center gap-0.5 max-w-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wide border rounded ${cfg.badgeClass}`}
    >
      <Icon className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" aria-hidden />
      <span className="truncate sm:hidden">{cfg.shortLabel || cfg.label}</span>
      <span className="truncate hidden sm:inline">{cfg.label}</span>
    </span>
  );
}

function InvoiceIcon({ compact }) {
  return (
    <div
      className={`${compact ? 'w-9 h-9' : 'w-10 h-10 sm:w-11 sm:h-11'} rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0`}
      aria-hidden
    >
      <FaFileInvoiceDollar className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
    </div>
  );
}

function AmountDisplay({ summary, status }) {
  const total = summary.total || summary.paid + summary.balance;

  if (status === 'paid') {
    return (
      <p className="text-lg sm:text-[1.375rem] font-bold text-white tabular-nums leading-none text-right">
        ${summary.paid.toFixed(2)}
      </p>
    );
  }

  if (status === 'partial') {
    const pct = total > 0 ? Math.min(100, (summary.paid / total) * 100) : 0;
    return (
      <div className="w-full text-right min-w-0">
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
        <p className="text-[9px] sm:text-[10px] text-amber-400/90 mt-1 font-medium">Due on receipt</p>
      </div>
    );
  }

  return (
    <div className="text-right min-w-0">
      <p className="text-lg sm:text-[1.375rem] font-bold text-white tabular-nums leading-none">
        ${summary.balance.toFixed(2)}
      </p>
      <p className="text-[9px] sm:text-[10px] text-red-400/90 font-medium mt-1">Due on receipt</p>
    </div>
  );
}

function SecondaryActions({ canPay, invoice, onPay, onViewEstimate, compact }) {
  if (compact || (!canPay && !(invoice.estimate_available && onViewEstimate))) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {canPay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPay(invoice);
          }}
          className="h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] font-bold rounded border border-emerald-500/35 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
        >
          Pay ${Number(invoice.balance_due).toFixed(2)}
        </button>
      )}
      {invoice.estimate_available && onViewEstimate && (
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
  );
}

function ViewInvoiceButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] sm:text-[13px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap"
    >
      View Invoice →
    </button>
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
  const stretchY = compact ? '-my-2.5 sm:-my-3' : '-my-3 sm:-my-3.5';

  const handleCardClick = () => onView?.(invoice);
  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && onView) {
      e.preventDefault();
      onView(invoice);
    }
  };
  const openInvoice = (e) => {
    e.stopPropagation();
    onView?.(invoice);
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
        className={`grid grid-cols-[minmax(0,1.55fr)_1px_minmax(96px,0.9fr)] sm:grid-cols-[minmax(0,1.62fr)_1px_minmax(148px,0.88fr)] ${pad} gap-x-2 sm:gap-x-4 items-stretch max-w-full`}
      >
        {/* Left — invoice details */}
        <div className="flex gap-2 sm:gap-3 min-w-0">
          <InvoiceIcon compact={compact} />
          <div className="flex flex-col justify-between min-w-0 flex-1 gap-1.5 sm:gap-2">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-semibold tracking-[0.12em] sm:tracking-[0.14em] text-white/38 uppercase leading-none">
                Invoice
              </p>
              <p className="text-[15px] sm:text-[1.125rem] font-bold text-white truncate leading-tight mt-0.5 sm:mt-1">
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

        {/* Vertical divider */}
        <div className={`bg-white/[0.08] w-px self-stretch ${stretchY}`} aria-hidden />

        {/* Right — status, amount, action */}
        <div className="flex flex-col justify-between items-end text-right min-w-0 min-h-[72px] sm:min-h-[76px] py-0.5">
          <StatusBadge status={status} />

          <div className="flex-1 flex flex-col justify-center w-full my-0.5 sm:my-1 min-w-0">
            <AmountDisplay summary={summary} status={status} />
          </div>

          <div className="w-full flex flex-col items-end gap-1 sm:gap-1.5 min-w-0">
            {(status === 'paid' || status === 'outstanding') && (
              <div className="w-full border-t border-white/[0.06] pt-1.5 sm:pt-2" aria-hidden />
            )}
            <ViewInvoiceButton onClick={openInvoice} />
            <SecondaryActions
              canPay={canPay}
              invoice={invoice}
              onPay={onPay}
              onViewEstimate={onViewEstimate}
              compact={compact}
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
