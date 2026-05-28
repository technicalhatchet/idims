import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TechDashboardLayout from '../../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../../components/ui/ErrorAlert';
import { getDmaErrorCode, searchDmaRepairs } from '../../../../services/api/dmaApi';
import {
  buildDmaRepairSearchHref,
  formatDmaSubtype,
} from '../../../../constants/dmaErrorCodes';
import { formatDmaEquipment } from '../../../../constants/dmaEquipmentOptions';

function DetailRow({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <dt className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-200 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function DmaErrorCodeDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [reference, setReference] = useState(null);
  const [history, setHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await getDmaErrorCode(id);
      setReference(data);
      setError(null);

      const repairs = await searchDmaRepairs({
        equipment_make: data.manufacturer,
        equipment_subtype: data.equipment_subtype,
        error_code: data.code_normalized,
        repair_successful: true,
        limit: 10,
      });
      setHistory(repairs);
    } catch (err) {
      setError(err.message || 'Failed to load error code');
      setReference(null);
      setHistory(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const repairSearchHref = reference
    ? buildDmaRepairSearchHref({
        make: reference.manufacturer,
        subtype: reference.equipment_subtype,
        errorCode: reference.code_normalized,
      })
    : '/techdashboard/dma';

  return (
    <>
      <Head>
        <title>{reference ? `${reference.code} | Error Code` : 'Error Code'} | Repair Memory</title>
      </Head>

      <div className="px-4 py-6 max-w-3xl mx-auto pb-24">
        <Link href="/techdashboard/dma/codes" className="text-sm text-gray-500 hover:text-orange-400">
          ← Error Code Lookup
        </Link>

        {isLoading && (
          <div className="py-16 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {error && <div className="mt-6"><ErrorAlert message={error} onRetry={load} /></div>}

        {!isLoading && reference && (
          <>
            <div className="mt-6 mb-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400/90 mb-1">
                {reference.manufacturer} · {formatDmaSubtype(reference.equipment_subtype)}
              </p>
              <h1 className="text-3xl font-bold text-orange-300">{reference.code}</h1>
              <p className="text-lg text-white mt-2">{reference.meaning}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4 mb-6">
              <DetailRow label="Common causes">{reference.common_causes}</DetailRow>
              <DetailRow label="Recommended fix">{reference.recommended_fix}</DetailRow>
            </div>

            {reference.related_codes?.length > 1 && (
              <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4 mb-6">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                  Related codes
                </p>
                <div className="flex flex-wrap gap-2">
                  {reference.related_codes.map((item) => (
                    <Link
                      key={item.id}
                      href={`/techdashboard/dma/codes/${item.id}`}
                      className={`text-sm px-2.5 py-1 rounded-lg border ${
                        item.id === reference.id
                          ? 'border-orange-500/40 bg-orange-500/10 text-orange-200'
                          : 'border-white/10 text-gray-300 hover:border-orange-500/30'
                      }`}
                    >
                      {item.code}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-white">Your repair history</h2>
                <Link href={repairSearchHref} className="text-xs text-cyan-400 hover:text-cyan-300">
                  View all →
                </Link>
              </div>
              {!history?.items?.length ? (
                <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4 text-sm text-gray-400">
                  No confirmed fixes recorded yet for this code.
                </div>
              ) : (
                <ul className="space-y-3">
                  {history.items.map((item) => (
                    <li key={`${item.source_type}-${item.id}`}>
                      <Link
                        href={
                          item.source_type === 'field_record'
                            ? `/techdashboard/dma/records/${item.id}`
                            : `/work_orders/${item.work_order_id}/mobile?tab=notes`
                        }
                        className="block rounded-xl border border-white/10 bg-[#0D1525] p-4 hover:border-cyan-500/30 transition-colors"
                      >
                        <p className="text-sm font-medium text-white">{formatDmaEquipment(item)}</p>
                        <p className="text-sm text-gray-200 mt-2">{item.confirmed_fix}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

DmaErrorCodeDetailPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default DmaErrorCodeDetailPage;
