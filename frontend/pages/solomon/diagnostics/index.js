import { useEffect, useState } from 'react';
import Link from 'next/link';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../../components/solomon/SolomonErrorBoundary';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { formatSolomonDateTime } from '../../../utils/solomonFormat';
import { SYNC_EVENT } from '../../../lib/offlineMutations';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import { listStandaloneDiagnosticsOffline, deleteStandaloneDiagnosticOffline, deleteAllStandaloneDiagnosticsOffline } from '../../../lib/solomonOfflineWrites';
import SolomonAccessGuard from '../../../components/solomon/SolomonAccessGuard';

function DiagnosticRow({ item, onDelete, isDeleting }) {
  if (!item?.id) return null;
  const label = item.template_label || item.template_id || 'Diagnostic';
  const equipment = [item.equipment_make, item.equipment_model].filter(Boolean).join(' ');
  const when = formatSolomonDateTime(item.updated_at);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1525] hover:border-cyan-500/30 transition-colors">
      <div className="flex items-stretch gap-2 p-4">
        <Link href={`/solomon/diagnostics/${item.id}`} className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-white">{label}</p>
              {equipment ? <p className="text-sm text-gray-400 mt-0.5">{equipment}</p> : null}
              {item.customer_complaint ? (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.customer_complaint}</p>
              ) : null}
            </div>
            <span
              className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${
                item.pendingSync
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
                  : item.outcome_id
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                    : item.status === 'in_progress' || !item.status
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
              }`}
            >
              {item.pendingSync
                ? 'Pending sync'
                : item.outcome_id
                  ? 'Linked'
                  : item.status === 'in_progress' || !item.status
                    ? 'In progress'
                    : item.status === 'abandoned'
                      ? 'Abandoned'
                      : 'Unlinked'}
            </span>
          </div>
          {when ? <p className="text-xs text-gray-500 mt-2">{when}</p> : null}
        </Link>
        <button
          type="button"
          onClick={() => onDelete(item)}
          disabled={isDeleting}
          className="shrink-0 self-center rounded-lg border border-red-500/25 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          aria-label={`Delete ${label}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function SolomonDiagnosticsListPage() {
  const { canUseSolomon, isLoading: authLoading, isDiyer, rolesLoading } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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

  const handleDeleteOne = async (item) => {
    const label = item.template_label || item.template_id || 'this diagnostic';
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeletingId(item.id);
    try {
      await deleteStandaloneDiagnosticOffline(item.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    const list = data?.items || [];
    if (!list.length) return;
    if (!window.confirm(`Delete all ${list.length} diagnostics shown? This cannot be undone.`)) return;
    setIsDeletingAll(true);
    setError(null);
    try {
      await deleteAllStandaloneDiagnosticsOffline(list);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to delete diagnostics');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const items = data?.items || [];

  if (authLoading || rolesLoading) {
    return (
      <>
        <SolomonHead title="Diagnostics" />
        <SolomonPageMain className="flex justify-center">
          <LoadingSpinner />
        </SolomonPageMain>
      </>
    );
  }

  return (
    <SolomonErrorBoundary>
        <SolomonHead title={copy('diagnosticsTitle')} />
      <SolomonPageMain>
        <SolomonAccessGuard promptTitle="Sign in to view your diagnostics">
        <Link href="/solomon" className="text-xs text-cyan-400 hover:text-cyan-300">← Solomon</Link>
        <h1 className="text-2xl font-semibold mt-3 mb-4">{copy('diagnosticsTitle')}</h1>

        <div className="flex gap-2 mb-4">
          {[
            { id: 'all', label: 'All' },
            { id: 'unlinked', label: 'Unlinked' },
            { id: 'linked', label: 'Linked' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                filter === tab.id
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200'
                  : 'border-white/10 text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Link
          href={isDiyer ? '/solomon/start' : '/solomon/diagnose'}
          className="block mb-4 rounded-xl bg-[#0089B9] px-4 py-3 text-center font-medium"
        >
          {copy('diagnosticNew')}
        </Link>

        {error ? <ErrorAlert message={error} /> : null}
        {fromCache ? (
          <p className="text-xs text-amber-300/80 mb-3">Showing saved diagnostics from your device.</p>
        ) : null}
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            {isDiyer ? 'No troubleshooting sessions yet.' : 'No diagnostics yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isDeletingAll || deletingId}
                className="text-xs text-red-300 border border-red-500/25 rounded-lg px-3 py-1.5 hover:bg-red-500/10 disabled:opacity-40"
              >
                {isDeletingAll ? 'Deleting all…' : `Delete all (${items.length})`}
              </button>
            </div>
            {items.map((item) => (
              <DiagnosticRow
                key={item.id}
                item={item}
                onDelete={handleDeleteOne}
                isDeleting={deletingId === item.id || isDeletingAll}
              />
            ))}
          </div>
        )}
        </SolomonAccessGuard>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
