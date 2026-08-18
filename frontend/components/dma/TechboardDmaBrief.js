import Link from 'next/link';
import { useDmaSuggestions } from '../../hooks/useDmaSuggestions';

/**
 * Compact Repair Memory strip for the TechDeck next-job card.
 * Clicks stay on DMA links — parent card should wrap this in stopPropagation.
 */
export default function TechboardDmaBrief({ workOrderId, equipmentMake, equipmentSubtype }) {
  const make = (equipmentMake || '').trim();
  const subtype = (equipmentSubtype || '').trim();
  const canSuggest = Boolean(make && subtype);

  const { data: suggestions, isLoading } = useDmaSuggestions({
    equipmentMake: make,
    equipmentSubtype: subtype,
    workOrderId,
    enabled: canSuggest,
  });

  if (!canSuggest) return null;

  if (isLoading && !suggestions) {
    return (
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">Repair Memory</p>
        <p className="text-xs text-gray-500 mt-0.5 animate-pulse">Checking past fixes…</p>
      </div>
    );
  }

  const historyCount = suggestions?.total_count || 0;
  const topFixes = (suggestions?.common_fixes || []).slice(0, 2);
  const errorCodes = suggestions?.detected_error_codes || [];
  const codeRef = suggestions?.error_code_references?.[0];

  if (!suggestions || (!historyCount && !errorCodes.length && !codeRef)) {
    return null;
  }

  const dmaHref = (() => {
    const query = new URLSearchParams();
    if (suggestions.search_params?.equipment_make) query.set('make', suggestions.search_params.equipment_make);
    if (suggestions.search_params?.equipment_subtype) query.set('subtype', suggestions.search_params.equipment_subtype);
    if (suggestions.search_params?.error_code) query.set('error', suggestions.search_params.error_code);
    const qs = query.toString();
    return `/techdashboard/dma${qs ? `?${qs}` : ''}`;
  })();

  return (
    <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/[0.06] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Repair Memory</p>
        {historyCount > 0 && (
          <span className="text-[10px] text-cyan-300/70 tabular-nums">{historyCount} past fix{historyCount === 1 ? '' : 'es'}</span>
        )}
      </div>
      {errorCodes.length > 0 && (
        <p className="text-xs text-orange-300/90 mb-1">
          Code: {errorCodes.slice(0, 3).join(', ')}
        </p>
      )}
      {codeRef && !errorCodes.length && (
        <p className="text-xs text-orange-200/90 mb-1 truncate">
          {codeRef.code}: {codeRef.meaning}
        </p>
      )}
      {topFixes.length > 0 && (
        <ul className="space-y-0.5">
          {topFixes.map((fix) => (
            <li key={fix.label} className="text-xs text-gray-200 leading-snug flex gap-1.5">
              <span className="text-cyan-400/80 shrink-0">•</span>
              <span className="truncate">
                {fix.label}
                {fix.count > 1 && <span className="text-gray-500 ml-1">({fix.count}×)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={dmaHref}
        className="inline-block mt-1.5 text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
      >
        Open DMA →
      </Link>
    </div>
  );
}
