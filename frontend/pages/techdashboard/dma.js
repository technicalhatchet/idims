import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { getDmaCodes, getDmaTags, searchDmaRepairs } from '../../services/api/dmaApi';
import { formatDmaEquipment } from '../../constants/dmaEquipmentOptions';
import { codeLabel, codeOptions, DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES } from '../../constants/dmaCodes';
import { DmaTagPills } from '../../components/dma/DmaTagPicker';
import { groupTagsByCategory } from '../../constants/dmaTagCategories';

function resultHref(item) {
  if (item.source_type === 'field_record') {
    return `/techdashboard/dma/records/${item.id}`;
  }
  return `/work_orders/${item.work_order_id}/mobile?tab=notes`;
}

function SourceBadge({ item }) {
  if (item.source_type === 'field_record') {
    return (
      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
        Field record
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
      {item.order_number || 'Work order'}
    </span>
  );
}

function DmaSearchPage() {
  const router = useRouter();
  const [codes, setCodes] = useState(null);
  const [query, setQuery] = useState('');
  const [equipmentMake, setEquipmentMake] = useState('');
  const [equipmentSubtype, setEquipmentSubtype] = useState('');
  const [problemCode, setProblemCode] = useState('');
  const [resolutionCode, setResolutionCode] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [includeUnsuccessful, setIncludeUnsuccessful] = useState(false);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDmaCodes()
      .then(setCodes)
      .catch((err) => console.error('Failed to load DMA codes', err));
    getDmaTags()
      .then((data) => setTagCatalog(data?.items || []))
      .catch((err) => console.error('Failed to load DMA tags', err));
  }, []);

  useEffect(() => {
    if (!router.isReady) return undefined;

    const make = typeof router.query.make === 'string' ? router.query.make : '';
    const subtype = typeof router.query.subtype === 'string' ? router.query.subtype : '';
    const error = typeof router.query.error === 'string' ? router.query.error : '';
    const hasPrefill = Boolean(make || subtype || error);

    if (make) setEquipmentMake(make);
    if (subtype) setEquipmentSubtype(subtype);
    if (error) setErrorCode(error);

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await searchDmaRepairs({
          equipment_make: make || undefined,
          equipment_subtype: subtype || undefined,
          error_code: error || undefined,
          repair_successful: true,
          limit: hasPrefill ? 30 : 20,
        });
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
  }, [
    router.isReady,
    router.query.make,
    router.query.subtype,
    router.query.error,
  ]);

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
        tags: selectedTags.length ? selectedTags : undefined,
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
  }, [query, equipmentMake, equipmentSubtype, problemCode, resolutionCode, errorCode, selectedTags, includeUnsuccessful]);

  const problemOptions = codes?.problem_codes || DMA_PROBLEM_CODES;
  const resolutionOptions = codes?.resolution_codes || DMA_RESOLUTION_CODES;

  return (
    <>
      <Head>
        <title>DMA Repair Memory | Field Tech Dashboard</title>
      </Head>

      <div className="px-4 py-6 max-w-3xl mx-auto pb-24">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90 mb-1">
              Diagnostic Memory Amplifier
            </p>
            <h1 className="text-2xl font-bold text-white">Repair Memory</h1>
            <p className="text-sm text-gray-400 mt-1">
              Search past confirmed fixes by equipment, error code, or symptom.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link
              href="/techdashboard/dma/patterns"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-200"
            >
              Patterns
            </Link>
            <Link
              href="/techdashboard/dma/codes"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-orange-500/30 bg-orange-500/10 text-sm font-semibold text-orange-200"
            >
              Error codes
            </Link>
            <Link
              href="/techdashboard/dma/new"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-sm font-semibold text-white"
            >
              + Add field record
            </Link>
          </div>
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

          {tagCatalog.length > 0 && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Tags</label>
              <div className="space-y-3">
                {groupTagsByCategory(tagCatalog).map((group) => (
                  <div key={group.key}>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => {
                        const active = selectedTags.includes(tag.slug);
                        return (
                          <button
                            key={tag.slug}
                            type="button"
                            onClick={() => {
                              setSelectedTags((prev) => (
                                prev.includes(tag.slug)
                                  ? prev.filter((s) => s !== tag.slug)
                                  : [...prev, tag.slug]
                              ));
                            }}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              active
                                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                                : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-cyan-500/30'
                            }`}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <div className="rounded-xl border border-white/10 bg-[#0D1525] p-6 text-center text-gray-400 text-sm space-y-2">
                <p>No repair memory found yet.</p>
                <p>
                  <Link href="/techdashboard/dma/new" className="text-amber-400 hover:text-amber-300">Add a field record</Link>
                  {' '}or add a <strong className="text-cyan-400">Repair Outcome</strong> note on a work order.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {results.items.map((item) => (
                  <li key={`${item.source_type}-${item.id}`}>
                    <Link
                      href={resultHref(item)}
                      className="block rounded-xl border border-white/10 bg-[#0D1525] p-4 hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2 flex-wrap">
                        <SourceBadge item={item} />
                        {!item.repair_successful && (
                          <span className="text-[10px] uppercase tracking-wide text-orange-400">Unsuccessful</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white">{formatDmaEquipment(item)}</p>
                      {item.error_code_text && (
                        <p className="text-xs text-orange-300 mt-1">Code: {item.error_code_text}</p>
                      )}
                      <p className="text-sm text-gray-200 mt-2">{item.confirmed_fix}</p>
                      <div className="mt-2">
                        <DmaTagPills tags={item.tags} />
                      </div>
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
