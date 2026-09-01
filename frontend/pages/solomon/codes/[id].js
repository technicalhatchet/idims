import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { getDmaErrorCode, searchDmaRepairs } from '../../../services/api/dmaApi';
import { formatDmaSubtype } from '../../../constants/dmaErrorCodes';
import { formatDmaEquipment } from '../../../constants/dmaEquipmentOptions';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import SolomonListPage from '../../../components/solomon/SolomonListPage';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_LIST_STACK_CLASS,
  SOLOMON_REFERENCE_CHIP_ACTIVE_CLASS,
  SOLOMON_REFERENCE_CHIP_IDLE_CLASS,
  SOLOMON_REFERENCE_CODE_TEXT_CLASS,
  SOLOMON_REFERENCE_EYEBROW_CLASS,
} from '../../../components/solomon/solomonListPageUi';

function DetailRow({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="py-3 border-b border-[color:var(--solomon-border-muted)] last:border-0">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--solomon-text-muted)] mb-1">{label}</dt>
      <dd className="text-sm text-[var(--solomon-text-secondary)] whitespace-pre-wrap leading-relaxed">{children}</dd>
    </div>
  );
}

export default function SolomonErrorCodeDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { canUseSolomon } = useSolomonAuth();
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

      if (canUseSolomon) {
        const repairs = await searchDmaRepairs({
          equipment_make: data.manufacturer,
          equipment_subtype: data.equipment_subtype,
          error_code: data.code_normalized,
          repair_successful: true,
          limit: 8,
        });
        setHistory(repairs);
      } else {
        setHistory(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load error code');
      setReference(null);
      setHistory(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, canUseSolomon]);

  useEffect(() => {
    load();
  }, [load]);

  const pageTitle = reference ? `${reference.code} — Error code` : 'Error code';

  return (
    <SolomonListPage
      headTitle={pageTitle}
      back="arrow"
      backHref="/solomon/codes"
      backLabel="Back to error codes"
    >
      {isLoading && (
        <div className="py-16 flex justify-center">
          <LoadingSpinner />
        </div>
      )}

      {error ? (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      ) : null}

      {!isLoading && reference && (
        <>
          <header className="mb-5">
            <p className={`${SOLOMON_REFERENCE_EYEBROW_CLASS} mb-1`}>
              {reference.manufacturer} · {formatDmaSubtype(reference.equipment_subtype)}
            </p>
            <h1 className={`text-3xl font-bold tracking-tight ${SOLOMON_REFERENCE_CODE_TEXT_CLASS}`}>
              {reference.code}
            </h1>
            <p className="text-lg text-[var(--solomon-text-primary)] mt-2 leading-snug">{reference.meaning}</p>
          </header>

          <div className={`${SOLOMON_GLASS_PANEL_CLASS} mb-5`}>
            <dl>
              <DetailRow label="Common causes">{reference.common_causes}</DetailRow>
              <DetailRow label="Recommended fix">{reference.recommended_fix}</DetailRow>
            </dl>
          </div>

          {reference.related_codes?.length > 1 ? (
            <div className={`${SOLOMON_GLASS_PANEL_CLASS} mb-5`}>
              <p className="text-[10px] uppercase tracking-wide text-[var(--solomon-text-muted)] mb-2">
                Related codes
              </p>
              <div className="flex flex-wrap gap-2">
                {reference.related_codes.map((item) => (
                  <Link
                    key={item.id}
                    href={`/solomon/codes/${item.id}`}
                    className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                      item.id === reference.id
                        ? SOLOMON_REFERENCE_CHIP_ACTIVE_CLASS
                        : SOLOMON_REFERENCE_CHIP_IDLE_CLASS
                    }`}
                  >
                    {item.code}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {canUseSolomon ? (
            <section className="mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-[var(--solomon-text-primary)]">Repair memory</h2>
                <Link
                  href="/solomon/knowledge"
                  className="text-xs text-[var(--solomon-primary-from)]/90 hover:opacity-80"
                >
                  Search all →
                </Link>
              </div>
              {!history?.items?.length ? (
                <div className={`${SOLOMON_GLASS_PANEL_CLASS} text-sm text-[var(--solomon-text-secondary)]`}>
                  No confirmed fixes recorded yet for this code in repair memory.
                </div>
              ) : (
                <ul className={SOLOMON_LIST_STACK_CLASS}>
                  {history.items.map((item) => (
                    <li
                      key={`${item.source_type}-${item.id}`}
                      className={`${SOLOMON_GLASS_PANEL_CLASS} text-sm`}
                    >
                      <p className="font-medium text-[var(--solomon-text-primary)]">{formatDmaEquipment(item)}</p>
                      <p className="text-[var(--solomon-text-secondary)] mt-2 leading-relaxed">{item.confirmed_fix}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <p className="text-sm text-amber-300/90 mb-6">
              Sign in to see repair memory for this code.
            </p>
          )}
        </>
      )}
    </SolomonListPage>
  );
}
