import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { SORT_OPTIONS, STATUS_FILTERS } from './appliancesPageUtils';

const selectClass =
  'w-full h-11 px-3 rounded-lg bg-white/5 border border-white/10 text-gray-200 text-base focus:outline-none focus:border-cyan-500/40';

const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5';

export default function AppliancesFiltersSheet({
  open,
  onClose,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortChange,
  typeOptions,
  onFindFromHistory,
  historySuggestionCount = 0,
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end touch-manipulation">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        className="relative z-[1] max-h-[min(85vh,520px)] w-full rounded-t-2xl border border-white/10 bg-[#0B0F1A] flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="m-0 text-base font-semibold text-white">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className={selectClass}
            >
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Type</label>
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className={selectClass}
            >
              <option value="all">All types</option>
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Sort</label>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className={selectClass}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {onFindFromHistory ? (
            <button
              type="button"
              onClick={() => {
                onFindFromHistory();
                onClose();
              }}
              className="w-full h-11 rounded-lg border border-white/10 bg-white/[0.03] text-sm font-semibold text-gray-200 inline-flex items-center justify-center gap-2"
            >
              Find from service history
              {historySuggestionCount > 0 ? (
                <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold inline-flex items-center justify-center">
                  {historySuggestionCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>

        <footer className="px-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-lg bg-[#00D4FF] text-[#0A0F1E] font-bold text-sm"
          >
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
