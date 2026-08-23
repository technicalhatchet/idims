import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import SolomonAuthPrompt from '../../../components/solomon/SolomonAuthPrompt';
import { format } from 'date-fns';
import SolomonHead from '../../../components/solomon/SolomonHead';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { listDmaRepairRecords } from '../../../services/api/dmaApi';

export default function SolomonOutcomesListPage() {
  const { isAuthenticated, isLoading: authLoading, isDiyer } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    setIsLoading(true);
    listDmaRepairRecords({ limit: 50 })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load outcomes');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <>
        <SolomonHead title={copy('outcomesTitle')} />
        <main className="min-h-screen bg-[#0A0F1E] text-white p-6 flex justify-center"><LoadingSpinner /></main>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SolomonHead title="Sign in" />
        <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-8 max-w-lg mx-auto">
          <SolomonAuthPrompt title="Sign in to view your repair notes" />
        </main>
      </>
    );
  }

  const items = data?.items || [];

  return (
    <>
      <SolomonHead title={copy('outcomesTitle')} />
      <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-6 max-w-lg mx-auto pb-24">
        <Link href="/solomon" className="text-xs text-cyan-400 hover:text-cyan-300">← Solomon</Link>
        <h1 className="text-2xl font-semibold mt-3 mb-4">{copy('outcomesTitle')}</h1>

        <Link href="/solomon/outcomes/new" className="block mb-4 rounded-xl bg-[#0089B9] px-4 py-3 text-center font-medium">
          {copy('outcomeNew')}
        </Link>

        {error ? <ErrorAlert message={error} /> : null}
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            {isDiyer ? 'No repair notes yet.' : 'No outcomes yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/solomon/outcomes/${item.id}`}
                className="block rounded-xl border border-white/10 bg-[#0D1525] p-4 hover:border-cyan-500/30"
              >
                <p className="font-medium line-clamp-2">{item.confirmed_fix}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {isDiyer ? 'Troubleshooting session(s)' : `${item.linked_diagnostic_count || 0} diagnostic(s)`}
                  {item.updated_at ? ` · ${format(new Date(item.updated_at), 'MMM d')}` : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
