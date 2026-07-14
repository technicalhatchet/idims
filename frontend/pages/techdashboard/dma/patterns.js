import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import DmaPatternReport from '../../../components/dma/DmaPatternReport';
import { getDmaCodes, getDmaPatternReport, getDmaTags } from '../../../services/api/dmaApi';
import { codeOptions, DMA_PROBLEM_CODES } from '../../../constants/dmaCodes';
import { groupTagsByCategory } from '../../../constants/dmaTagCategories';

function DmaPatternsPage() {
  const router = useRouter();
  const [codes, setCodes] = useState(null);
  const [equipmentMake, setEquipmentMake] = useState('');
  const [equipmentSubtype, setEquipmentSubtype] = useState('refrigerator');
  const [problemCode, setProblemCode] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [minCases, setMinCases] = useState(2);
  const [report, setReport] = useState(null);
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

  const runReport = useCallback(async (overrides = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const make = (overrides.equipmentMake ?? equipmentMake).trim();
      const subtype = (overrides.equipmentSubtype ?? equipmentSubtype).trim();
      const problem = overrides.problemCode ?? problemCode;
      const tags = overrides.selectedTags ?? selectedTags;
      const min = overrides.minCases ?? minCases;

      const data = await getDmaPatternReport({
        equipment_make: make || undefined,
        equipment_subtype: subtype || undefined,
        problem_code: problem || undefined,
        tags: tags.length ? tags : undefined,
        min_cases: min,
        limit: 12,
      });
      setReport(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load pattern report');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [equipmentMake, equipmentSubtype, problemCode, selectedTags, minCases]);

  useEffect(() => {
    if (!router.isReady) return undefined;
    const make = typeof router.query.make === 'string' ? router.query.make : '';
    const subtype = typeof router.query.subtype === 'string' ? router.query.subtype : 'refrigerator';
    if (make) setEquipmentMake(make);
    if (subtype) setEquipmentSubtype(subtype);
    runReport({ equipmentMake: make, equipmentSubtype: subtype });
    return undefined;
  }, [router.isReady, router.query.make, router.query.subtype, runReport]);

  const problemOptions = codes?.problem_codes || DMA_PROBLEM_CODES;
  const tagGroups = groupTagsByCategory(tagCatalog);

  const handleSubmit = (e) => {
    e.preventDefault();
    runReport();
  };

  return (
    <>
      <Head>
        <title>Pattern Discovery | Repair Memory</title>
      </Head>

      <div className="px-4 py-6 max-w-3xl mx-auto pb-24">
        <div className="mb-6">
          <Link href="/techdashboard/dma" className="text-sm text-gray-500 hover:text-cyan-400">
            ← Repair Memory
          </Link>
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/90 mt-3 mb-1">
            Phase 6f · Read-only
          </p>
          <h1 className="text-2xl font-bold text-white">Pattern discovery</h1>
          <p className="text-sm text-gray-400 mt-1">
            Callback rates, fix success, and common repairs by complaint, tag, and diagnostic evidence path.
            Does not change live diagnostic scores.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-3 mb-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Make</label>
              <input
                type="text"
                value={equipmentMake}
                onChange={(e) => setEquipmentMake(e.target.value)}
                placeholder="Samsung, Whirlpool…"
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Appliance type</label>
              <input
                type="text"
                value={equipmentSubtype}
                onChange={(e) => setEquipmentSubtype(e.target.value)}
                placeholder="refrigerator"
                className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Problem code</label>
            <select
              value={problemCode}
              onChange={(e) => setProblemCode(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="">All problems</option>
              {codeOptions(problemOptions).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {tagGroups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-gray-400">Tags (optional)</p>
              {tagGroups.map((group) => (
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
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                              : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-emerald-500/30'
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
          )}

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Minimum cases per row</label>
            <select
              value={minCases}
              onChange={(e) => setMinCases(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
            >
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>{n}+ cases</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {isLoading ? 'Building report…' : 'Run pattern report'}
          </button>
        </form>

        {error && <ErrorAlert message={error} onRetry={() => runReport()} />}

        {isLoading && (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {!isLoading && report && <DmaPatternReport report={report} />}
      </div>
    </>
  );
}

DmaPatternsPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default DmaPatternsPage;
