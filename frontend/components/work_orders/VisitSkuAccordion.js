import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { listVisitSkuLines } from '../../utils/visitSku';

const BILLING_LABELS = {
  not_billable: 'Not billable',
  billable: 'Billable',
  paid: 'Paid',
  waived: 'Waived',
};

function billingBadgeClass(status) {
  switch (status) {
    case 'billable':
      return 'bg-amber-500/20 text-amber-200 border-amber-500/30';
    case 'paid':
      return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30';
    case 'waived':
      return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    default:
      return 'bg-white/5 text-gray-400 border-white/10';
  }
}

export default function VisitSkuAccordion({
  appointment,
  catalogServices = [],
  workOrderServices = [],
  expanded = false,
  onToggle,
  onMoveSku,
  canEdit = false,
  compact = false,
  theme = 'dark',
}) {
  const isLight = theme === 'light';
  const lines = listVisitSkuLines(appointment, { catalogServices, workOrderServices });

  if (!lines.length) {
    return (
      <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-500 mt-1`}>No SKUs on this visit.</p>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 text-left text-xs font-medium ${
          isLight ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 hover:text-white'
        }`}
      >
        <span>
          {lines.length} SKU{lines.length === 1 ? '' : 's'}
        </span>
        {expanded ? <FaChevronUp className="shrink-0" /> : <FaChevronDown className="shrink-0" />}
      </button>
      {expanded && (
        <ul
          className={`mt-1.5 space-y-1.5 ${
            compact
              ? ''
              : isLight
                ? 'rounded-lg border border-gray-200 bg-gray-50 p-2'
                : 'rounded-lg border border-white/10 bg-black/20 p-2'
          }`}
        >
          {lines.map((line) => (
            <li
              key={line.serviceId}
              className="flex items-start justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <p className={`font-medium truncate ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>{line.name}</p>
                {line.price != null && (
                  <p className="text-gray-500">${Number(line.price).toFixed(2)}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${billingBadgeClass(line.billing_status)}`}
                >
                  {BILLING_LABELS[line.billing_status] || line.billing_status}
                </span>
                {canEdit && line.canMove && onMoveSku && (
                  <button
                    type="button"
                    onClick={() => onMoveSku(appointment, line.serviceId)}
                    className={`text-[10px] underline ${
                      isLight ? 'text-blue-600 hover:text-blue-800' : 'text-cyan-400 hover:text-cyan-300'
                    }`}
                  >
                    Reschedule
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
