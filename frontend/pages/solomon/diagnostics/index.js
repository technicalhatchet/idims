import { useEffect, useState } from 'react';
import Link from 'next/link';
import SolomonPageHeader from '../../../components/solomon/SolomonPageHeader';
import SolomonPageAtmosphere from '../../../components/solomon/SolomonPageAtmosphere';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../../components/solomon/SolomonErrorBoundary';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { SYNC_EVENT } from '../../../lib/offlineMutations';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import { listStandaloneDiagnosticsOffline } from '../../../lib/solomonOfflineWrites';
import SolomonAccessGuard from '../../../components/solomon/SolomonAccessGuard';
import {
  SOLOMON_FILTER_ACTIVE_CLASS,
  SOLOMON_FILTER_IDLE_CLASS,
  SOLOMON_LIST_STACK_CLASS,
  SOLOMON_PAGE_SHELL_CLASS,
  SolomonCyanAddButton,
} from '../../../components/solomon/solomonListPageUi';
import SolomonDiagnosticListCard from '../../../components/solomon/SolomonDiagnosticListCard';

export default function SolomonDiagnosticsListPage() {
  const { canUseSolomon, isLoading: authLoading, isDiyer, rolesLoading } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const pageTitle = isDiyer ? copy('diagnosticsTitle') : 'My Diagnostics';
  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';

  useEffect(() => {
    const onSync = () => setReloadKey((k) => k + 1);
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    if (!canUseSolomon) return undefined;
    let cancelled = false;
    setIsLoading(true);
    const params = { limit: 50 };
    if (filter === 'unlinked') params.linked = false;
    if (filter === 'linked') params.linked = true;

    listStandaloneDiagnosticsOffline(params)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setFromCache(Boolean(res.fromCache));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load diagnostics');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canUseSolomon, filter, reloadKey]);

  const items = data?.items || [];

  if (authLoading || rolesLoading) {
    return (
      <>
        <SolomonHead title="Diagnostics" />
        <SolomonPageMain className={`flex flex-col ${SOLOMON_PAGE_SHELL_CLASS}`}>
          <SolomonPageAtmosphere />
          <div className="relative">
            <SolomonPageHeader />
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          </div>
        </SolomonPageMain>
      </>
    );
  }

  return (
    <SolomonErrorBoundary>
      <SolomonHead title={pageTitle} />
      <SolomonPageMain className={SOLOMON_PAGE_SHELL_CLASS}>
        <SolomonPageAtmosphere />
        <SolomonAccessGuard promptTitle="Sign in to view your diagnostics">
          <div className="relative">
            <SolomonPageHeader />

            <header className="mb-5">
              <h1 className="text-[1.75rem] font-bold tracking-tight text-white leading-tight">
                {pageTitle}
              </h1>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                {isDiyer ? 'Your troubleshooting history and progress.' : 'Your diagnostic history and progress.'}
              </p>
            </header>

            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unlinked', label: 'Unlinked' },
                  { id: 'linked', label: 'Linked' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                      filter === tab.id ? SOLOMON_FILTER_ACTIVE_CLASS : SOLOMON_FILTER_IDLE_CLASS
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <SolomonCyanAddButton href={newHref} ariaLabel={copy('diagnosticNew')} />
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {fromCache ? (
              <p className="text-xs text-amber-300/80 mb-3">Showing saved diagnostics from your device.</p>
            ) : null}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : items.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">
                {isDiyer ? 'No troubleshooting sessions yet.' : 'No diagnostics yet.'}
              </p>
            ) : (
              <div className={SOLOMON_LIST_STACK_CLASS}>
                {items.map((item) => (
                  <SolomonDiagnosticListCard key={item.id} item={item} />
                ))}
              </div>
            )}

            <p className="mt-8 text-center text-xs text-white/38 leading-relaxed">
              Can&apos;t find what you&apos;re looking for?{' '}
              <Link href="/solomon/knowledge" className="text-cyan-400/90 hover:text-cyan-300 transition-colors">
                Search repair memory →
              </Link>
            </p>
          </div>
        </SolomonAccessGuard>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
