import {
  SOLOMON_REFERENCE_CHIP_ACTIVE_CLASS,
  SOLOMON_REFERENCE_CHIP_IDLE_CLASS,
} from '../solomonListPageUi';

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

const POPULATION_A_STATUSES = ['accept_staged', 'defer_staged', 'reject_staged'];
const POPULATION_B_STATUSES = ['accept_staged', 'keep_production_baseline', 'defer_review'];

function label(status) {
  return status.replace(/_/g, ' ');
}

export default function DeltaReconciliationDecisionBar({
  population,
  selectedStatus,
  saving,
  decisionsLoading,
  error,
  onDecision,
}) {
  const statuses = population === 'A' ? POPULATION_A_STATUSES : POPULATION_B_STATUSES;
  return (
    <div
      className={classNames(
        'sticky top-0 z-10 -mx-4 border-b border-[color:var(--solomon-border-muted)]',
        'bg-[var(--solomon-surface-glass)] px-4 py-3 solomon-backdrop-blur',
        'lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none',
      )}
    >
      <p className="text-[11px] text-[var(--solomon-text-muted)]">
        Population {population} reconciliation:
        {' '}
        <span className="text-[var(--solomon-text-primary)]">{selectedStatus}</span>
      </p>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            disabled={saving || decisionsLoading}
            onClick={() => onDecision(status)}
            className={classNames(
              'solomon-focus-ring rounded-lg border px-2 py-2.5 text-xs capitalize transition-colors disabled:opacity-50',
              selectedStatus === status
                ? SOLOMON_REFERENCE_CHIP_ACTIVE_CLASS
                : SOLOMON_REFERENCE_CHIP_IDLE_CLASS,
            )}
          >
            {label(status)}
          </button>
        ))}
      </div>
    </div>
  );
}
