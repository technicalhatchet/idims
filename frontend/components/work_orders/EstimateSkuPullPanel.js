import Button from '../ui/Button';
import {
  formatEstimateLineSkuLabel,
  estimateLinesNotOnVisit,
} from '../../utils/estimateVisitSkus';

/**
 * Lets schedulers attach unscheduled estimate SKUs to a visit in one click.
 */
export default function EstimateSkuPullPanel({
  estimateLines = [],
  selectedCatalogIds = [],
  catalogServices = [],
  onAddAll,
  onAddLine,
  compact = false,
  isMobile = false,
}) {
  const pending = estimateLinesNotOnVisit(estimateLines, selectedCatalogIds);

  if (!estimateLines.length) return null;

  if (!pending.length) {
    return (
      <p
        className={`${
          compact ? 'text-xs' : 'text-sm'
        } text-gray-500 dark:text-gray-400 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2`}
      >
        All estimate SKUs are already on this visit.
      </p>
    );
  }

  return (
    <div
      className={`rounded-md border border-cyan-500/30 bg-cyan-500/10 ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      }`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2'}`}>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-cyan-900 dark:text-cyan-100`}>
          {pending.length} unscheduled estimate SKU{pending.length === 1 ? '' : 's'} available
        </p>
        {isMobile ? (
          <button
            type="button"
            onClick={onAddAll}
            className="inline-flex items-center rounded-lg border border-cyan-500/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-300"
          >
            Add all
          </button>
        ) : (
          <Button type="button" onClick={onAddAll} variant="secondary" size="xs">
            Add all from estimate
          </Button>
        )}
      </div>
      <ul className={`space-y-1 ${compact ? 'text-[11px]' : 'text-xs'} text-cyan-950/80 dark:text-cyan-100/90`}>
        {pending.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1">{formatEstimateLineSkuLabel(line, catalogServices)}</span>
            {onAddLine && (
              <button
                type="button"
                onClick={() => onAddLine(line)}
                className={`shrink-0 font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300 hover:underline ${
                  compact ? 'text-[10px]' : 'text-xs'
                }`}
              >
                Add
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
