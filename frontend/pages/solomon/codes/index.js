import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaHashtag, FaSearch } from 'react-icons/fa';
import SolomonPageHeader from '../../../components/solomon/SolomonPageHeader';
import SolomonPageAtmosphere from '../../../components/solomon/SolomonPageAtmosphere';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../../components/solomon/SolomonErrorBoundary';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { searchDmaErrorCodes } from '../../../services/api/dmaApi';
import {
  DMA_CANONICAL_MANUFACTURERS,
  formatDmaSubtype,
} from '../../../constants/dmaErrorCodes';
import { DMA_APPLIANCE_SUBTYPES } from '../../../constants/dmaEquipmentOptions';
import {
  SOLOMON_GLASS_INPUT_CLASS,
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_GLASS_SELECT_OPTION_CLASS,
  SOLOMON_LIST_STACK_CLASS,
  SOLOMON_PAGE_SHELL_CLASS,
} from '../../../components/solomon/solomonListPageUi';

const SOLOMON_CODES_SEARCH_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 border border-emerald-400/30 px-4 py-3 text-sm font-medium text-white shadow-[0_4px_18px_rgba(16,185,129,0.28)] transition-colors hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50';

function CodeResultRow({ item }) {
  return (
    <li>
      <Link
        href={`/solomon/codes/${item.id}`}
        className="block rounded-xl border border-white/15 bg-[#060a12]/78 backdrop-blur-md p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-emerald-400/25 hover:bg-[#060a12]/86 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-emerald-300">{item.code}</p>
            <p className="text-sm text-white mt-1 line-clamp-2">{item.meaning}</p>
            <p className="text-[11px] text-gray-500 mt-2">
              {item.manufacturer} · {formatDmaSubtype(item.equipment_subtype)}
            </p>
          </div>
          <span className="text-xs text-gray-500 shrink-0 pt-0.5" aria-hidden>→</span>
        </div>
      </Link>
    </li>
  );
}

export default function SolomonErrorCodesPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [equipmentMake, setEquipmentMake] = useState('');
  const [equipmentSubtype, setEquipmentSubtype] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async (overrides = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchDmaErrorCodes({
        code: (overrides.code ?? code).trim() || undefined,
        equipment_make: (overrides.equipmentMake ?? equipmentMake).trim() || undefined,
        equipment_subtype: (overrides.equipmentSubtype ?? equipmentSubtype).trim() || undefined,
        q: (overrides.query ?? query).trim() || undefined,
        limit: 50,
      });
      setResults(data);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [code, equipmentMake, equipmentSubtype, query]);

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

    if (codeParam || make || subtype || qParam) {
      runSearch({
        equipmentMake: make,
        equipmentSubtype: subtype,
        code: codeParam,
        query: qParam,
      });
    }
    return undefined;
  }, [router.isReady, router.query.make, router.query.subtype, router.query.code, router.query.q, runSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <SolomonErrorBoundary>
      <SolomonHead title="Error codes" />
      <SolomonPageMain className={SOLOMON_PAGE_SHELL_CLASS}>
        <SolomonPageAtmosphere />
        <div className="relative">
          <SolomonPageHeader back="arrow" backHref="/solomon" backLabel="Back to Solomon home" />

          <header className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <FaHashtag size={14} aria-hidden />
              </span>
              <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-400/90">Reference</p>
            </div>
            <h1 className="text-[1.75rem] font-bold tracking-tight text-white leading-tight">
              Error codes
            </h1>
            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
              Manufacturer fault codes with meaning, common causes, and recommended fixes.
            </p>
          </header>

          <form onSubmit={handleSubmit} className={`${SOLOMON_GLASS_PANEL_CLASS} space-y-3`}>
            <div>
              <label htmlFor="solomon-code-search" className="sr-only">Error code</label>
              <input
                id="solomon-code-search"
                type="search"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code on display — 22E, F dH, tC…"
                autoComplete="off"
                className={SOLOMON_GLASS_INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <select
                value={equipmentMake}
                onChange={(e) => setEquipmentMake(e.target.value)}
                aria-label="Manufacturer"
                className={SOLOMON_GLASS_INPUT_CLASS}
              >
                <option value="" className={SOLOMON_GLASS_SELECT_OPTION_CLASS}>Any make</option>
                {DMA_CANONICAL_MANUFACTURERS.map((make) => (
                  <option key={make} value={make} className={SOLOMON_GLASS_SELECT_OPTION_CLASS}>
                    {make}
                  </option>
                ))}
              </select>
              <select
                value={equipmentSubtype}
                onChange={(e) => setEquipmentSubtype(e.target.value)}
                aria-label="Appliance type"
                className={SOLOMON_GLASS_INPUT_CLASS}
              >
                <option value="" className={SOLOMON_GLASS_SELECT_OPTION_CLASS}>All appliances</option>
                {DMA_APPLIANCE_SUBTYPES.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value} className={SOLOMON_GLASS_SELECT_OPTION_CLASS}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Or search meaning / causes…"
              className={SOLOMON_GLASS_INPUT_CLASS}
            />

            <button
              type="submit"
              disabled={isLoading}
              className={SOLOMON_CODES_SEARCH_BUTTON_CLASS}
            >
              <FaSearch size={13} aria-hidden />
              {isLoading ? 'Searching…' : 'Look up code'}
            </button>
          </form>

          {error ? <ErrorAlert message={error} className="mt-4" /> : null}

          {isLoading && !results ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : null}

          {results ? (
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.08em] text-white/35 mb-3">
                {results.total} code{results.total === 1 ? '' : 's'}
              </p>
              {results.items.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">
                  No matches — try the exact code with make and appliance selected.
                </p>
              ) : (
                <ul className={SOLOMON_LIST_STACK_CLASS}>
                  {results.items.map((item) => (
                    <CodeResultRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
