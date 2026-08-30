import { useCallback, useState } from 'react';
import {
  FaBook,
  FaCheckCircle,
  FaConciergeBell,
  FaFire,
  FaSearch,
  FaSnowflake,
  FaTint,
  FaWind,
} from 'react-icons/fa';
import SolomonPageHeader from '../../components/solomon/SolomonPageHeader';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonPageMain from '../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../components/solomon/SolomonErrorBoundary';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { searchDmaRepairs } from '../../services/api/dmaApi';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonPoolSearchResultStatus,
  solomonDiagnosticListCardClass,
} from '../../components/solomon/solomonDiagnosticStatus';
import { DMA_APPLIANCE_SUBTYPES } from '../../constants/dmaEquipmentOptions';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525]/90 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20 transition-colors';

const SUBTYPE_ICON_MAP = {
  refrigerator: FaSnowflake,
  freezer: FaSnowflake,
  dishwasher: FaConciergeBell,
  washing_machine: FaTint,
  dryer: FaFire,
  aio_laundry: FaWind,
};

const MEMORY_ICON_SHELL =
  'bg-purple-500/12 border-purple-500/25 text-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.14)]';

function getSubtypeIcon(subtype) {
  return SUBTYPE_ICON_MAP[subtype] || FaBook;
}

function formatEquipmentLine(item) {
  const subtypeLabel = DMA_APPLIANCE_SUBTYPES.find((o) => o.value === item.equipment_subtype)?.label
    || item.equipment_subtype?.replace(/_/g, ' ');
  return [item.equipment_make, item.equipment_model, subtypeLabel].filter(Boolean).join(' • ');
}

function StatusBadge({ status }) {
  const showCheck = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory
    || status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_successful;

  return (
    <span className={`inline-flex items-center gap-1 ${status.badgeClass} text-[9px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full shrink-0`}>
      {showCheck ? <FaCheckCircle size={10} aria-hidden /> : null}
      {status.label}
    </span>
  );
}

function SearchResultRow({ item }) {
  const status = resolveSolomonPoolSearchResultStatus(item);
  const Icon = getSubtypeIcon(item.equipment_subtype);
  const equipment = formatEquipmentLine(item);

  return (
    <li className={`${solomonDiagnosticListCardClass(status)} backdrop-blur-md transition-all duration-200 hover:brightness-[1.03]`}>
      <div className="p-3.5">
        <div className="flex gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${MEMORY_ICON_SHELL}`}>
            <Icon size={16} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[15px] leading-tight text-white line-clamp-2">
                {item.confirmed_fix || 'Repair outcome'}
              </p>
              <StatusBadge status={status} />
            </div>
            {equipment ? (
              <p className="text-[11px] text-white/45 mt-0.5 truncate">{equipment}</p>
            ) : null}
            {item.error_code_text ? (
              <p className="text-xs text-white/55 mt-1.5 line-clamp-2 leading-snug">{item.error_code_text}</p>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function KnowledgeAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -left-16 h-52 w-52 rounded-full bg-cyan-500/[0.07] blur-3xl" />
      <div className="absolute top-1/4 -right-20 h-44 w-44 rounded-full bg-purple-500/[0.06] blur-3xl" />
      <div className="absolute bottom-32 left-8 h-36 w-36 rounded-full bg-orange-500/[0.05] blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/20 via-transparent to-[#070b14]/60" />
    </div>
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
      <SolomonPageMain className="!bg-[#070b14] relative overflow-hidden">
        <KnowledgeAtmosphere />
        <div className="relative">
          <SolomonPageHeader />

          <h1 className="text-[1.65rem] font-semibold tracking-tight text-white">Repair memory</h1>
          <p className="text-sm text-white/50 mt-1 mb-4">
            Search confirmed fixes from past jobs — same DMA pool technicians use in the field.
          </p>

          {!canUseSolomon ? (
            <p className="text-sm text-amber-300/90">Sign in to search repair memory.</p>
          ) : (
            <form
              onSubmit={runSearch}
              className="rounded-xl border border-white/10 bg-[#0D1525]/60 backdrop-blur-md p-4 space-y-3 shadow-[0_0_24px_rgba(0,0,0,0.2)]"
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Symptom, fix, or notes…"
                className={inputClass}
              />
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={equipmentSubtype}
                  onChange={(e) => setEquipmentSubtype(e.target.value)}
                  className={inputClass}
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
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-4 py-3 text-sm font-medium text-white shadow-[0_4px_16px_rgba(0,137,185,0.35)] transition-colors hover:from-[#0099cc] hover:to-[#007aa8] disabled:opacity-50"
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
              <p className="text-[11px] uppercase tracking-[0.08em] text-white/35 mb-2.5">
                {results.items.length} result{results.items.length === 1 ? '' : 's'}
              </p>
              <ul className="space-y-2.5">
                {results.items.map((item) => (
                  <SearchResultRow key={`${item.source_type}-${item.id}`} item={item} />
                ))}
              </ul>
            </div>
          ) : results && !isLoading ? (
            <p className="text-white/45 text-sm text-center py-10">No matches — try broader terms.</p>
          ) : null}
        </div>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
