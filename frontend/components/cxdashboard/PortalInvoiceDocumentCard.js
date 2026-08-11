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
    Icon: FaCheckCircle,
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  partial: {
    label: 'PARTIALLY PAID',
    Icon: FaClock,
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  outstanding: {
    label: 'OUTSTANDING',
    Icon: FaExclamationCircle,
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.outstanding;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold tracking-wide border rounded ${cfg.badgeClass}`}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" aria-hidden />
      {cfg.label}
    </span>
  );
}

function FinancialPanel({ summary, status }) {
  const total = summary.total || summary.paid + summary.balance;

  if (status === 'paid') {
    return (
      <div className="flex flex-col items-end justify-between h-full min-h-[88px]">
        <StatusBadge status="paid" />
        <p className="text-2xl font-bold text-white tabular-nums mt-2">
          ${summary.paid.toFixed(2)}
        </p>
        <div className="w-full border-t border-white/[0.06] mt-3 pt-3" aria-hidden />
      </div>
    );
  }

  if (status === 'partial') {
    const pct = total > 0 ? Math.min(100, (summary.paid / total) * 100) : 0;
    return (
      <div className="flex flex-col items-end justify-start h-full w-full">
        <StatusBadge status="partial" />
        <p className="text-lg sm:text-xl font-bold text-white tabular-nums mt-2 text-right">
          <span className="text-white">${summary.balance.toFixed(2)}</span>
          <span className="text-white/40 font-medium text-sm sm:text-base mx-1">of</span>
          <span className="text-white/70 font-semibold">${total.toFixed(2)}</span>
        </p>
        <div className="w-full mt-2">
          <div
            className="h-1 rounded-full bg-white/[0.08] overflow-hidden"
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
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
        <p className="text-[11px] text-amber-400/90 mt-2 font-medium w-full text-right">
          Due on receipt
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end justify-between h-full min-h-[88px]">
      <StatusBadge status="outstanding" />
      <p className="text-2xl font-bold text-white tabular-nums mt-2">
        ${summary.balance.toFixed(2)}
      </p>
      <p className="text-[11px] text-red-400/90 font-medium mt-1">Due on receipt</p>
    </div>
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={[
        'group relative rounded-lg border bg-[#0D1525] overflow-hidden transition-colors',
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
      {/* Desktop / tablet */}
      <div className={`hidden sm:flex ${compact ? 'p-3.5' : 'p-4 md:p-5'}`}>
        <div className="flex-[1.65] min-w-0 pr-4 md:pr-6">
          <div className="flex gap-3 items-start">
            <FaFileInvoiceDollar
              className="w-10 h-10 text-cyan-400 shrink-0 mt-0.5"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-white/40 uppercase">
                Invoice
              </p>
              <p className="text-lg md:text-xl font-bold text-white truncate mt-0.5">
                {invoice.order_number}
              </p>
              <p className="text-sm text-white/80 mt-1 truncate">{applianceLine}</p>
              {dateLine && (
                <p className="flex items-center gap-1.5 text-xs text-white/45 mt-3">
                  <FaCalendarAlt className="w-3 h-3 shrink-0" aria-hidden />
                  <time dateTime={invoice.created_at}>{dateLine}</time>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="w-px bg-white/[0.08] self-stretch shrink-0" aria-hidden />

        <div className="flex-[1] min-w-[140px] pl-4 md:pl-6 flex flex-col">
          <FinancialPanel summary={summary} status={status} />
          <div className="mt-auto pt-3 flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(invoice);
              }}
              className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View Invoice →
            </button>
            {!compact && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {canPay && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPay(invoice);
                    }}
                    className="h-7 px-2.5 text-[11px] font-bold rounded border border-emerald-500/35 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
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
                    className="h-7 px-2.5 inline-flex items-center gap-1 text-[11px] font-semibold rounded border border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors"
                  >
                    <FaFileAlt className="w-2.5 h-2.5" aria-hidden />
                    Estimate
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className={`sm:hidden ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-2.5 min-w-0">
            <FaFileInvoiceDollar className="w-8 h-8 text-cyan-400 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.1em] text-white/40 uppercase">
                Invoice
              </p>
              <p className="text-base font-bold text-white truncate">{invoice.order_number}</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        <p className="text-sm text-white/80 mt-2 pl-[42px]">{applianceLine}</p>
        {dateLine && (
          <p className="text-xs text-white/45 mt-1 pl-[42px]">{dateLine}</p>
        )}

        {status === 'partial' && (
          <div className="mt-3 pl-[42px]">
            <p className="text-base font-bold text-white tabular-nums">
              ${summary.balance.toFixed(2)}
              <span className="text-white/40 font-medium text-sm mx-1">of</span>
              <span className="text-white/70 font-semibold text-sm">
                ${(summary.total || summary.paid + summary.balance).toFixed(2)}
              </span>
            </p>
            <div
              className="h-1 rounded-full bg-white/[0.08] overflow-hidden mt-2 max-w-full"
              role="progressbar"
              aria-valuenow={Math.round(
                summary.total > 0 ? (summary.paid / summary.total) * 100 : 0,
              )}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`$${summary.paid.toFixed(2)} paid of $${(summary.total || 0).toFixed(2)} total`}
            >
              <div
                className="h-full bg-cyan-400 rounded-full"
                style={{
                  width: `${summary.total > 0 ? Math.min(100, (summary.paid / summary.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-amber-400/90 mt-1.5 font-medium">Due on receipt</p>
          </div>
        )}

        <div className="border-t border-white/[0.06] mt-3 pt-3 pl-[42px]">
          {status === 'paid' && (
            <p className="text-xl font-bold text-white tabular-nums mb-2">
              ${summary.paid.toFixed(2)}
            </p>
          )}
          {status === 'outstanding' && (
            <>
              <p className="text-xl font-bold text-white tabular-nums">${summary.balance.toFixed(2)}</p>
              <p className="text-[11px] text-red-400/90 font-medium mt-1">Due on receipt</p>
            </>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView?.(invoice);
            }}
            className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors mt-2"
          >
            View Invoice →
          </button>
          {!compact && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {canPay && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPay(invoice);
                  }}
                  className="h-7 px-2.5 text-[11px] font-bold rounded border border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
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
                  className="h-7 px-2.5 inline-flex items-center gap-1 text-[11px] font-semibold rounded border border-violet-500/25 bg-violet-500/10 text-violet-300"
                >
                  <FaFileAlt className="w-2.5 h-2.5" aria-hidden />
                  Estimate
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
