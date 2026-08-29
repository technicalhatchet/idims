import Link from 'next/link';
import { useCallback, useState } from 'react';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonPageMain from '../../components/solomon/SolomonPageMain';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { searchDmaRepairs } from '../../services/api/dmaApi';
import {
  resolveSolomonPoolSearchResultStatus,
  solomonDiagnosticListCardClass,
  SolomonDiagnosticStatusBadge,
} from '../../components/solomon/solomonDiagnosticStatus';
import { DMA_APPLIANCE_SUBTYPES } from '../../constants/dmaEquipmentOptions';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none';

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
    <>
      <SolomonHead title="Knowledge base" />
      <SolomonPageMain>
        <Link href="/solomon" className="text-xs text-cyan-400 hover:text-cyan-300">← Home</Link>
        <h1 className="text-2xl font-semibold mt-3">Repair memory</h1>
        <p className="text-sm text-white/60 mt-2">
          Search confirmed fixes from past jobs — same DMA pool technicians use in the field.
        </p>

        {!canUseSolomon ? (
          <p className="text-sm text-amber-300/90 mt-6">Sign in to search repair memory.</p>
        ) : (
          <form onSubmit={runSearch} className="mt-6 space-y-3">
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
              className="w-full rounded-xl bg-[#0089B9] px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
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
          <ul className="mt-6 space-y-2">
            {results.items.map((item) => {
              const status = resolveSolomonPoolSearchResultStatus(item);
              return (
              <li
                key={`${item.source_type}-${item.id}`}
                className={`px-4 py-3 ${solomonDiagnosticListCardClass(status)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-white line-clamp-2 min-w-0">
                    {item.confirmed_fix || 'Repair outcome'}
                  </p>
                  <SolomonDiagnosticStatusBadge status={status} />
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {[item.equipment_make, item.equipment_model, item.equipment_subtype?.replace(/_/g, ' ')]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {item.error_code_text ? (
                  <p className="text-xs text-gray-400 mt-1">{item.error_code_text}</p>
                ) : null}
              </li>
              );
            })}
          </ul>
        ) : results && !isLoading ? (
          <p className="text-sm text-gray-500 mt-6 text-center">No matches — try broader terms.</p>
        ) : null}
      </SolomonPageMain>
    </>
  );
}
