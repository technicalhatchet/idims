import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { formatDmaSubtype } from '../../constants/dmaErrorCodes';
import { useDmaSuggestions } from '../../hooks/useDmaSuggestions';

function buildRepairMemoryHref(searchParams) {
  const query = new URLSearchParams();
  if (searchParams?.equipment_make) query.set('make', searchParams.equipment_make);
  if (searchParams?.equipment_subtype) query.set('subtype', searchParams.equipment_subtype);
  if (searchParams?.error_code) query.set('error', searchParams.error_code);
  const qs = query.toString();
  return `/techdashboard/dma${qs ? `?${qs}` : ''}`;
}

function DmaSuggestionsLoading() {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-3">
      <p className="text-sm font-semibold text-cyan-100/80">Repair Memory</p>
      <p className="text-xs text-gray-500 mt-0.5 animate-pulse">Checking past fixes…</p>
    </div>
  );
}

export default function DmaSuggestionsAccordion({
  workOrderId,
  equipmentMake,
  equipmentSubtype,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const make = (equipmentMake || '').trim();
  const subtype = (equipmentSubtype || '').trim();
  const canSuggest = Boolean(make && subtype);

  const { data: suggestions, isLoading, isFetching } = useDmaSuggestions({
    equipmentMake: make,
    equipmentSubtype: subtype,
    workOrderId,
    enabled: canSuggest,
  });

  const repairMemoryHref = useMemo(
    () => buildRepairMemoryHref(suggestions?.search_params),
    [suggestions?.search_params],
  );

  if (!canSuggest) {
    return null;
  }

  if ((isLoading || isFetching) && !suggestions) {
    return <DmaSuggestionsLoading />;
  }

  const referenceCount = suggestions?.error_code_references?.length || 0;
  const historyCount = suggestions?.total_count || 0;
  if (!suggestions || (!historyCount && !referenceCount)) {
    return null;
  }

  const title = historyCount
    ? `DMA Q Suggests (${historyCount})`
    : `DMA Q Reference (${referenceCount})`;
  const summary =
    suggestions.common_fixes?.[0]?.label ||
    suggestions.error_code_references?.[0]?.meaning ||
    (suggestions.detected_error_codes?.length
      ? `Error ${suggestions.detected_error_codes[0]}`
      : 'Past fixes for this equipment');

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:bg-cyan-500/[0.06]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-cyan-100">{title}</p>
          {!isOpen && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{summary}</p>
          )}
        </div>
        {isOpen ? (
          <FaChevronUp className="h-4 w-4 text-cyan-400/70 flex-shrink-0" />
        ) : (
          <FaChevronDown className="h-4 w-4 text-cyan-400/70 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-cyan-500/15 space-y-3">
          {suggestions.detected_error_codes?.length > 0 && (
            <p className="text-xs text-orange-300/90">
              Detected code: {suggestions.detected_error_codes.join(', ')}
            </p>
          )}
          {suggestions.error_code_references?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                Code reference
              </p>
              <ul className="space-y-2">
                {suggestions.error_code_references.map((ref) => (
                  <li key={ref.id}>
                    <Link
                      href={`/techdashboard/dma/codes/${ref.id}`}
                      className="block rounded-lg border border-orange-500/20 bg-orange-500/[0.05] px-3 py-2 hover:border-orange-500/35"
                    >
                      <p className="text-sm font-medium text-orange-200">
                        {ref.code}
                        <span className="text-gray-500 font-normal ml-2">
                          {formatDmaSubtype(ref.equipment_subtype)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-300 mt-1 line-clamp-2">{ref.meaning}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {suggestions.common_fixes?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                Common fixes
              </p>
              <ul className="space-y-2">
                {suggestions.common_fixes.map((fix) => (
                  <li
                    key={fix.label}
                    className="text-sm text-gray-200 leading-snug flex gap-2"
                  >
                    <span className="text-cyan-400/80 shrink-0">•</span>
                    <span>
                      {fix.label}
                      {fix.count > 1 && (
                        <span className="text-xs text-gray-500 ml-1">({fix.count}×)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {historyCount > 0 && (
            <Link
              href={repairMemoryHref}
              className="inline-flex text-sm font-medium text-cyan-400 hover:text-cyan-300"
            >
              View all {historyCount} in Repair Memory →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
