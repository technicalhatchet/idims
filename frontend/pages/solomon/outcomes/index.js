import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import SolomonAccessGuard from '../../../components/solomon/SolomonAccessGuard';
import { format } from 'date-fns';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { listDmaRepairRecords } from '../../../services/api/dmaApi';

export default function SolomonOutcomesListPage() {
  const { canUseSolomon, isLoading: authLoading, isDiyer, rolesLoading } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canUseSolomon) return undefined;
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
  }, [canUseSolomon]);

  const items = data?.items || [];

  if (authLoading || rolesLoading) {
    return (
      <>
        <SolomonHead title={copy('outcomesTitle')} />
        <SolomonPageMain className="flex justify-center py-20">
          <LoadingSpinner />
        </SolomonPageMain>
      </>
    );
  }

  return (
    <>
      <SolomonHead title={copy('outcomesTitle')} />
      <SolomonPageMain>
        <SolomonAccessGuard promptTitle="Sign in to view your repair notes">
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
        </SolomonAccessGuard>
      </SolomonPageMain>
    </>
  );
}
