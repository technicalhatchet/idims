import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { getDmaSuggestions } from '../../services/api/dmaApi';

function buildRepairMemoryHref(searchParams) {
  const query = new URLSearchParams();
  if (searchParams?.equipment_make) query.set('make', searchParams.equipment_make);
  if (searchParams?.equipment_subtype) query.set('subtype', searchParams.equipment_subtype);
  if (searchParams?.error_code) query.set('error', searchParams.error_code);
  const qs = query.toString();
  return `/techdashboard/dma${qs ? `?${qs}` : ''}`;
}

export default function DmaSuggestionsAccordion({
  workOrderId,
  equipmentMake,
  equipmentSubtype,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const canSuggest = Boolean(equipmentMake?.trim() && equipmentSubtype?.trim());

  useEffect(() => {
    if (!canSuggest) {
      setSuggestions(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await getDmaSuggestions({
          equipment_make: equipmentMake.trim(),
          equipment_subtype: equipmentSubtype.trim(),
          work_order_id: workOrderId || undefined,
        });
        if (!cancelled) setSuggestions(data);
      } catch (err) {
        console.error('Failed to load DMA suggestions', err);
        if (!cancelled) setSuggestions(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canSuggest, equipmentMake, equipmentSubtype, workOrderId]);

  const repairMemoryHref = useMemo(
    () => buildRepairMemoryHref(suggestions?.search_params),
    [suggestions?.search_params],
  );

  if (!canSuggest || isLoading || !suggestions?.total_count) {
    return null;
  }

  const title = `DMA Q Suggests (${suggestions.total_count})`;
  const summary =
    suggestions.common_fixes?.[0]?.label ||
    (suggestions.detected_error_codes?.length
      ? `Error ${suggestions.detected_error_codes[0]} matches`
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
          <Link
            href={repairMemoryHref}
            className="inline-flex text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            View all {suggestions.total_count} in Repair Memory →
          </Link>
        </div>
      )}
    </div>
  );
}
