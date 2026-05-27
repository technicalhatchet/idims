import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { getDmaCodes, searchDmaRepairs } from '../../services/api/dmaApi';
import { codeLabel, codeOptions, DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES } from '../../constants/dmaCodes';

function formatEquipment(item) {
  const parts = [item.equipment_make, item.equipment_model].filter(Boolean);
  const subtype = item.equipment_subtype
    ? item.equipment_subtype.replace(/_/g, ' ')
    : '';
  if (parts.length) return parts.join(' ');
  return subtype || 'Unknown equipment';
}

function DmaSearchPage() {
  const [codes, setCodes] = useState(null);
  const [query, setQuery] = useState('');
  const [equipmentMake, setEquipmentMake] = useState('');
  const [equipmentSubtype, setEquipmentSubtype] = useState('');
  const [problemCode, setProblemCode] = useState('');
  const [resolutionCode, setResolutionCode] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [includeUnsuccessful, setIncludeUnsuccessful] = useState(false);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDmaCodes()
      .then(setCodes)
      .catch((err) => console.error('Failed to load DMA codes', err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await searchDmaRepairs({ repair_successful: true, limit: 20 });
        if (!cancelled) {
          setResults(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Search failed');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const runSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchDmaRepairs({
        q: query.trim() || undefined,
        equipment_make: equipmentMake.trim() || undefined,
        equipment_subtype: equipmentSubtype.trim() || undefined,
        problem_code: problemCode || undefined,
        resolution_code: resolutionCode || undefined,
        error_code: errorCode.trim() || undefined,
        repair_successful: includeUnsuccessful ? undefined : true,
        limit: 30,
      });
      setResults(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [query, equipmentMake, equipmentSubtype, problemCode, resolutionCode, errorCode, includeUnsuccessful]);

  const problemOptions = codes?.problem_codes || DMA_PROBLEM_CODES;
  const resolutionOptions = codes?.resolution_codes || DMA_RESOLUTION_CODES;

  return (
    <>
      <Head>
        <title>DMA Repair Memory | Field Tech Dashboard</title>
      </Head>

      <div className="px-4 py-6 max-w-3xl mx-auto pb-24">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90 mb-1">
            Diagnostic Memory Amplifier
          </p>
          <h1 className="text-2xl font-bold text-white">Repair Memory</h1>
          <p className="text-sm text-gray-400 mt-1">
            Search past confirmed fixes by equipment, error code, or symptom.
          </p>
        </div>

        <form
          onSubmit={runSearch}
          className="rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-3 mb-6"
        >
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Search</label>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="F9E1, drain pump, no cool…"
              className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Make</label>
              <input
                type="text"
                value={equipmentMake}
                onChange={(e) => setEquipmentMake(e.target.value)}
                placeholder="Whirlpool"
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Subtype</label>
              <input
                type="text"
                value={equipmentSubtype}
                onChange={(e) => setEquipmentSubtype(e.target.value)}
                placeholder="refrigerator"
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Problem</label>
              <select
                value={problemCode}
                onChange={(e) => setProblemCode(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
              >
                <option value="">Any problem</option>
                {codeOptions(problemOptions).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Resolution</label>
              <select
                value={resolutionCode}
                onChange={(e) => setResolutionCode(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
              >
                <option value="">Any resolution</option>
                {codeOptions(resolutionOptions).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Error code</label>
            <input
              type="text"
              value={errorCode}
              onChange={(e) => setErrorCode(e.target.value)}
              placeholder="F9E1"
              className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={includeUnsuccessful}
              onChange={(e) => setIncludeUnsuccessful(e.target.checked)}
              className="rounded border-white/20"
            />
            Include unsuccessful / callback repairs
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isLoading ? 'Searching…' : 'Search repair memory'}
          </button>
        </form>

        {error && <ErrorAlert message={error} onRetry={runSearch} />}

        {isLoading && (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {!isLoading && results && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              {results.total} result{results.total === 1 ? '' : 's'}
            </p>
            {results.items.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#0D1525] p-6 text-center text-gray-400 text-sm">
                No repair outcomes found. Add a <strong className="text-cyan-400">Repair Outcome</strong> note on a completed work order.
              </div>
            ) : (
              <ul className="space-y-3">
                {results.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/work_orders/${item.work_order_id}/mobile?tab=notes`}
                      className="block rounded-xl border border-white/10 bg-[#0D1525] p-4 hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-sm font-semibold text-cyan-400">{item.order_number}</span>
                        {!item.repair_successful && (
                          <span className="text-[10px] uppercase tracking-wide text-orange-400">Unsuccessful</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white">{formatEquipment(item)}</p>
                      {item.error_code_text && (
                        <p className="text-xs text-orange-300 mt-1">Code: {item.error_code_text}</p>
                      )}
                      <p className="text-sm text-gray-200 mt-2">{item.confirmed_fix}</p>
                      <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-gray-500">
                        {item.problem_code && (
                          <span>{codeLabel(problemOptions, item.problem_code)}</span>
                        )}
                        {item.resolution_code && (
                          <span>→ {codeLabel(resolutionOptions, item.resolution_code)}</span>
                        )}
                      </div>
                      {item.replaced_parts && (
                        <p className="text-xs text-gray-500 mt-1">Parts: {item.replaced_parts}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

DmaSearchPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default DmaSearchPage;
