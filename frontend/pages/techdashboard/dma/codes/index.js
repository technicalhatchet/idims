import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TechDashboardLayout from '../../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../../components/ui/ErrorAlert';
import { searchDmaErrorCodes } from '../../../../services/api/dmaApi';
import {
  DMA_CANONICAL_MANUFACTURERS,
  formatDmaSubtype,
} from '../../../../constants/dmaErrorCodes';

function DmaErrorCodesPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [equipmentMake, setEquipmentMake] = useState('');
  const [equipmentSubtype, setEquipmentSubtype] = useState('');
  const [code, setCode] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async (overrides = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchDmaErrorCodes({
        q: (overrides.query ?? query).trim() || undefined,
        equipment_make: (overrides.equipmentMake ?? equipmentMake).trim() || undefined,
        equipment_subtype: (overrides.equipmentSubtype ?? equipmentSubtype).trim() || undefined,
        code: (overrides.code ?? code).trim() || undefined,
        limit: 50,
      });
      setResults(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [query, equipmentMake, equipmentSubtype, code]);

  useEffect(() => {
    if (!router.isReady) return undefined;
    const make = typeof router.query.make === 'string' ? router.query.make : '';
    const subtype = typeof router.query.subtype === 'string' ? router.query.subtype : '';
    const codeParam = typeof router.query.code === 'string' ? router.query.code : '';
    const qParam = typeof router.query.q === 'string' ? router.query.q : '';

    if (make) setEquipmentMake(make);
    if (subtype) setEquipmentSubtype(subtype);
    if (codeParam) setCode(codeParam);
    if (qParam) setQuery(qParam);

    runSearch({
      equipmentMake: make,
      equipmentSubtype: subtype,
      code: codeParam,
      query: qParam,
    });
    return undefined;
  }, [router.isReady, router.query.make, router.query.subtype, router.query.code, router.query.q, runSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <>
      <Head>
        <title>Error Code Lookup | Repair Memory</title>
      </Head>

      <div className="px-4 py-6 max-w-3xl mx-auto pb-24">
        <div className="mb-6">
          <Link href="/techdashboard/dma" className="text-sm text-gray-500 hover:text-cyan-400">
            ← Repair Memory
          </Link>
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400/90 mt-3 mb-1">
            Reference Library
          </p>
          <h1 className="text-2xl font-bold text-white">Error Code Lookup</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manufacturer codes with meaning, common causes, and recommended fixes.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-3 mb-6"
        >
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Search</label>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="F9E1, long drain, thermistor…"
              className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Make</label>
              <select
                value={equipmentMake}
                onChange={(e) => setEquipmentMake(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
              >
                <option value="">Any make</option>
                {DMA_CANONICAL_MANUFACTURERS.map((make) => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Appliance</label>
              <select
                value={equipmentSubtype}
                onChange={(e) => setEquipmentSubtype(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
              >
                <option value="">Any appliance</option>
                <option value="washing_machine">Washing Machine</option>
                <option value="dryer">Dryer</option>
                <option value="refrigerator">Refrigerator</option>
                <option value="dishwasher">Dishwasher</option>
                <option value="oven">Oven / Range</option>
                <option value="microwave">Microwave</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Exact code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="F9E1"
              className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isLoading ? 'Searching…' : 'Search error codes'}
          </button>
        </form>

        {error && <ErrorAlert message={error} onRetry={() => runSearch()} />}

        {isLoading && (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {!isLoading && results && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              {results.total} code{results.total === 1 ? '' : 's'}
            </p>
            {results.items.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#0D1525] p-6 text-center text-gray-400 text-sm">
                No matching error codes in the reference library.
              </div>
            ) : (
              <ul className="space-y-3">
                {results.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/techdashboard/dma/codes/${item.id}`}
                      className="block rounded-xl border border-white/10 bg-[#0D1525] p-4 hover:border-orange-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-orange-300">{item.code}</p>
                          <p className="text-sm text-white mt-1">{item.meaning}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {item.manufacturer} · {formatDmaSubtype(item.equipment_subtype)}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">→</span>
                      </div>
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

DmaErrorCodesPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default DmaErrorCodesPage;
