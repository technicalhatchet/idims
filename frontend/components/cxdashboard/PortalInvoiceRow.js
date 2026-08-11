import { format, parseISO } from 'date-fns';
import { FaFileInvoiceDollar, FaPrint, FaCheckCircle, FaFileAlt } from 'react-icons/fa';
import InvoiceDownloadMenu from './InvoiceDownloadMenu';
import {
  formatPortalWorkOrderAppliance,
  getPortalInvoicePaymentSummary,
} from '../../utils/portalWorkOrderDisplay';

function PaymentBadge({ status }) {
  const styles = {
    paid: { label: 'Paid', bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.2)', icon: FaCheckCircle },
    partial: { label: 'Partial', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)', icon: FaCheckCircle },
    unpaid: { label: 'Outstanding', bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.2)', icon: FaCheckCircle },
  };
  const s = styles[status] || styles.unpaid;
  const Icon = s.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: '600' }}>
      <Icon style={{ fontSize: '10px' }} />{s.label}
    </span>
  );
}

export default function PortalInvoiceRow({
  invoice,
  onView,
  onViewEstimate,
  onPay,
  onPrint,
  printing = false,
  compact = false,
}) {
  const summary = getPortalInvoicePaymentSummary(invoice);
  const applianceLine = formatPortalWorkOrderAppliance(invoice);
  const dateLine = invoice.created_at ? format(parseISO(invoice.created_at), 'MMM d, yyyy') : '';

  return (
    <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: compact ? '1rem' : '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
        <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
          <FaFileInvoiceDollar style={{ color: '#22d3ee', fontSize: '1.25rem' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => onView?.(invoice)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#22d3ee',
              fontWeight: '600',
              fontSize: '0.9375rem',
              cursor: onView ? 'pointer' : 'default',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(34,211,238,0.3)',
              textAlign: 'left',
            }}
          >
            Invoice #{invoice.order_number}
          </button>

          <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '4px 0 0' }}>{dateLine}</p>
          {applianceLine && (
            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', margin: '2px 0 0' }}>{applianceLine}</p>
          )}

          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {summary.type === 'paid' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaCheckCircle style={{ color: '#22c55e', fontSize: '1.125rem', flexShrink: 0 }} />
                <div>
                  <p style={{ color: '#22c55e', fontWeight: '600', fontSize: '0.875rem', margin: 0 }}>Paid in full</p>
                  {summary.paid > 0 && (
                    <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '2px 0 0' }}>
                      Amount paid: ${summary.paid.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <p style={{ color: '#9ca3af', fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  Balance due
                </p>
                <p style={{ color: '#fff', fontWeight: '700', fontSize: '1.25rem', margin: 0 }}>
                  ${summary.balance.toFixed(2)}
                </p>
                {summary.type === 'partial' && summary.paid > 0 && (
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>
                    Paid so far: ${summary.paid.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <PaymentBadge status={invoice.payment_status} />
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {invoice.can_pay_online && Number(invoice.balance_due) >= 1 && onPay && (
              <button
                type="button"
                onClick={() => onPay(invoice)}
                style={{
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  background: 'rgba(34,197,94,0.15)',
                  color: '#4ade80',
                  border: '1px solid rgba(34,197,94,0.35)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Pay ${Number(invoice.balance_due).toFixed(2)}
              </button>
            )}
            {invoice.estimate_available && onViewEstimate && (
              <button
                type="button"
                title="View estimate"
                onClick={() => onViewEstimate(invoice)}
                style={{
                  height: '32px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '0 10px', background: 'rgba(139,92,246,0.12)', color: '#c4b5fd',
                  border: '1px solid rgba(139,92,246,0.25)', borderRadius: '6px',
                  fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
                }}
              >
                <FaFileAlt style={{ fontSize: '11px' }} />
                Estimate
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                title="Print invoice (light)"
                disabled={printing}
                onClick={() => onPrint(invoice)}
                style={{
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', cursor: printing ? 'wait' : 'pointer',
                }}
              >
                <FaPrint style={{ fontSize: '13px' }} />
              </button>
            )}
            <InvoiceDownloadMenu invoice={invoice} />
          </div>

          {summary.type === 'partial' && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    background: '#22d3ee',
                    height: '100%',
                    width: `${Math.min(100, (summary.paid / (summary.paid + summary.balance)) * 100)}%`,
                    borderRadius: '999px',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
