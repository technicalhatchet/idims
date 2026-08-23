import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { format } from 'date-fns';
import SolomonHead from '../../../components/solomon/SolomonHead';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { SYNC_EVENT } from '../../../lib/offlineMutations';
import { listStandaloneDiagnosticsOffline } from '../../../lib/solomonOfflineWrites';

function DiagnosticRow({ item }) {
  const label = item.template_label || item.template_id || 'Diagnostic';
  const equipment = [item.equipment_make, item.equipment_model].filter(Boolean).join(' ');
  const when = item.updated_at ? format(new Date(item.updated_at), 'MMM d, h:mm a') : '';

  return (
    <Link
      href={`/solomon/diagnostics/${item.id}`}
      className="block rounded-xl border border-white/10 bg-[#0D1525] p-4 hover:border-cyan-500/30 transition-colors"
    >
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
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
          }`}
        >
          {item.pendingSync ? 'Pending sync' : item.outcome_id ? 'Linked' : 'Unlinked'}
        </span>
      </div>
      {when ? <p className="text-xs text-gray-500 mt-2">{when}</p> : null}
    </Link>
  );
}

export default function SolomonDiagnosticsListPage() {
  const { user, isLoading: authLoading } = useUser();
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onSync = () => setReloadKey((k) => k + 1);
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
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
  }, [user, filter, reloadKey]);

  if (authLoading) {
    return (
      <>
        <SolomonHead title="Diagnostics" />
        <main className="min-h-screen bg-[#0A0F1E] text-white p-6 flex justify-center">
          <LoadingSpinner />
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <SolomonHead title="Sign in" />
        <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-8 max-w-lg mx-auto">
          <a href="/api/auth/login" className="block rounded-xl bg-[#0089B9] px-4 py-3 text-center font-medium">
            Sign in
          </a>
        </main>
      </>
    );
  }

  const items = data?.items || [];

  return (
    <>
      <SolomonHead title="Diagnostics" />
      <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-6 max-w-lg mx-auto pb-24">
        <Link href="/solomon" className="text-xs text-cyan-400 hover:text-cyan-300">← Solomon</Link>
        <h1 className="text-2xl font-semibold mt-3 mb-4">My diagnostics</h1>

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
          href="/solomon/diagnose"
          className="block mb-4 rounded-xl bg-[#0089B9] px-4 py-3 text-center font-medium"
        >
          New diagnostic
        </Link>

        {error ? <ErrorAlert message={error} /> : null}
        {fromCache ? (
          <p className="text-xs text-amber-300/80 mb-3">Showing saved diagnostics from your device.</p>
        ) : null}
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No diagnostics yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => <DiagnosticRow key={item.id} item={item} />)}
          </div>
        )}
      </main>
    </>
  );
}
