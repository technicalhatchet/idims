import { useCallback, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import ApplianceIcon from '../../components/ui/ApplianceIcon';
import SolomonPageHeader from '../../components/solomon/SolomonPageHeader';
import SolomonPageAtmosphere from '../../components/solomon/SolomonPageAtmosphere';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonPageMain from '../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../components/solomon/SolomonErrorBoundary';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { searchDmaRepairs } from '../../services/api/dmaApi';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonPoolSearchResultStatus,
} from '../../components/solomon/solomonDiagnosticStatus';
import {
  SOLOMON_GLASS_INPUT_CLASS,
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_ICON_SHELL_BY_LIFECYCLE,
  SOLOMON_LIST_CARD_PADDING_CLASS,
  SOLOMON_LIST_ICON_BOX_CLASS,
  SOLOMON_LIST_STACK_CLASS,
  SOLOMON_PAGE_SHELL_CLASS,
  SOLOMON_SEARCH_BUTTON_CLASS,
  SolomonListCardFooter,
  SolomonListLifecycleHeadline,
  solomonLifecycleListSurfaceClass,
} from '../../components/solomon/solomonListPageUi';
import { getRepairRecordCategoryLabel } from '../../components/solomon/solomonRepairRecordPresentation';
import { getEquipmentTypeForSubtype } from '../../components/solomon/solomonTemplateEquipment';
import { DMA_APPLIANCE_SUBTYPES } from '../../constants/dmaEquipmentOptions';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';

function formatEquipmentLine(item) {
  const subtypeLabel = DMA_APPLIANCE_SUBTYPES.find((o) => o.value === item.equipment_subtype)?.label
    || item.equipment_subtype?.replace(/_/g, ' ');
  return [item.equipment_make, item.equipment_model, subtypeLabel].filter(Boolean).join(' • ');
}

function SearchResultRow({ item }) {
  const status = resolveSolomonPoolSearchResultStatus(item);
  const equipmentType = getEquipmentTypeForSubtype(item.equipment_subtype);
  const equipment = formatEquipmentLine(item);
  const categoryLabel = getRepairRecordCategoryLabel(item);
  const iconShell = SOLOMON_ICON_SHELL_BY_LIFECYCLE[status.lifecycleKey]
    || SOLOMON_ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.repair_memory];

  return (
    <li className={solomonLifecycleListSurfaceClass(status)}>
      <div className={SOLOMON_LIST_CARD_PADDING_CLASS}>
        <div className="flex gap-3">
          <div className={`${SOLOMON_LIST_ICON_BOX_CLASS} ${iconShell}`}>
            <ApplianceIcon
              equipmentType={equipmentType}
              equipmentSubtype={item.equipment_subtype}
              className="w-6 h-6"
              glow="subtle"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[15px] leading-tight text-white line-clamp-2 min-w-0 flex-1">
                {item.confirmed_fix || 'Repair outcome'}
              </p>
              <SolomonListLifecycleHeadline status={status} categoryLabel={categoryLabel} />
            </div>
            {equipment ? (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{equipment}</p>
            ) : null}
            {item.error_code_text ? (
              <p className="text-xs text-gray-400/95 mt-1.5 line-clamp-2 leading-snug">{item.error_code_text}</p>
            ) : null}
            <SolomonListCardFooter status={status} />
          </div>
        </div>
      </div>
    </li>
  );
}

export default function SolomonKnowledgePage() {
  const { canUseSolomon } = useSolomonAuth();
  const [query, setQuery] = useState('');
  const [equipmentSubtype, setEquipmentSubtype] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchDmaRepairs({
        q: query.trim() || undefined,
        equipment_subtype: equipmentSubtype || undefined,
        error_code: errorCode.trim() || undefined,
        repair_successful: true,
        limit: 25,
      });
      setResults(data);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [query, equipmentSubtype, errorCode]);

  return (
    <SolomonErrorBoundary>
      <SolomonHead title="Repair memory" />
      <SolomonPageMain className={SOLOMON_PAGE_SHELL_CLASS}>
        <SolomonPageAtmosphere />
        <div className="relative">
          <SolomonPageHeader />

          <header className="mb-5">
            <h1 className="text-[1.75rem] font-bold tracking-tight text-white leading-tight">
              Repair memory
            </h1>
            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
              Search confirmed fixes from past jobs — same DMA pool technicians use in the field.
            </p>
          </header>

          {!canUseSolomon ? (
            <p className="text-sm text-amber-300/90">Sign in to search repair memory.</p>
          ) : (
            <form onSubmit={runSearch} className={`${SOLOMON_GLASS_PANEL_CLASS} space-y-3`}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Symptom, fix, or notes…"
                className={SOLOMON_GLASS_INPUT_CLASS}
              />
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={equipmentSubtype}
                  onChange={(e) => setEquipmentSubtype(e.target.value)}
                  className={SOLOMON_GLASS_INPUT_CLASS}
                >
                  <option value="">All appliances</option>
                  {DMA_APPLIANCE_SUBTYPES.filter((o) => o.value).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="Error code"
                  className={SOLOMON_GLASS_INPUT_CLASS}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={SOLOMON_SEARCH_BUTTON_CLASS}
              >
                <FaSearch size={13} aria-hidden />
                {isLoading ? 'Searching…' : 'Search'}
              </button>
            </form>
          )}

          {error ? <ErrorAlert message={error} className="mt-4" /> : null}

          {isLoading && !results ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : null}

          {results?.items?.length ? (
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.08em] text-white/35 mb-3">
                {results.items.length} result{results.items.length === 1 ? '' : 's'}
              </p>
              <ul className={SOLOMON_LIST_STACK_CLASS}>
                {results.items.map((item) => (
                  <SearchResultRow key={`${item.source_type}-${item.id}`} item={item} />
                ))}
              </ul>
            </div>
          ) : results && !isLoading ? (
            <p className="text-gray-400 text-sm text-center py-10">No matches — try broader terms.</p>
          ) : null}
        </div>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
