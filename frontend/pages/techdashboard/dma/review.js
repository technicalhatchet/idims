import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { DmaModerationBadge } from '../../../components/dma/DmaModerationPanel';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';
import { listDmaRepairRecords } from '../../../services/api/dmaApi';
import { formatDmaEquipment } from '../../../constants/dmaEquipmentOptions';

function DmaReviewQueuePage() {
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listDmaRepairRecords({
      moderation_status: 'pending',
      context: 'diy',
      limit: 50,
    })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load review queue');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const items = data?.items || [];

  return (
    <>
      <Head>
        <title>Review queue | Repair Memory</title>
      </Head>

      <div className="px-4 py-6 max-w-3xl mx-auto pb-24">
        <div className="mb-6">
          <Link href="/techdashboard/dma" className="text-xs text-cyan-400 hover:text-cyan-300">
            ← Repair Memory
          </Link>
          <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400/90 mt-3 mb-1">
            Manager review
          </p>
          <h1 className="text-2xl font-bold text-white">DIY review queue</h1>
          <p className="text-sm text-gray-400 mt-1">
            Homeowner submissions from Solomon awaiting approval for the shared repair pool.
          </p>
        </div>

        {error ? <ErrorAlert message={error} /> : null}

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#0D1525] p-8 text-center">
            <p className="text-gray-400 text-sm">No DIY submissions awaiting review.</p>
            <Link
              href="/techdashboard/dma"
              className="inline-block mt-4 text-sm text-cyan-400 hover:text-cyan-300"
            >
              Back to Repair Memory
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-2">
              {data?.total ?? items.length} pending
            </p>
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/techdashboard/dma/records/${item.id}`}
                className="block rounded-xl border border-white/10 bg-[#0D1525] p-4 hover:border-violet-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white line-clamp-2">
                      {item.confirmed_fix || 'No confirmed fix yet'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{formatDmaEquipment(item)}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {item.linked_diagnostic_count
                        ? `${item.linked_diagnostic_count} troubleshooting session(s)`
                        : 'No linked diagnostics'}
                      {item.updated_at ? ` · ${format(new Date(item.updated_at), 'MMM d, yyyy')}` : ''}
                    </p>
                  </div>
                  <DmaModerationBadge status={item.moderation_status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

DmaReviewQueuePage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default DmaReviewQueuePage;
