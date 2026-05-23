import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaPrint } from 'react-icons/fa';

import WorkOrderMobileShell from './WorkOrderMobileShell';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorAlert from '../ui/ErrorAlert';
import { useWorkOrder } from '../../hooks/useWorkOrders';
import {
  BriefcaseIcon,
  DebriefingList,
  fetchDebriefingEntries,
} from './debriefingShared';

export default function DebriefingFullPage({ workOrderId }) {
  const router = useRouter();
  const fromMobile = router.query.from !== 'desktop';
  const { data: workOrder, isLoading: woLoading, error: woError } = useWorkOrder(workOrderId);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const backHref = fromMobile
    ? `/work_orders/${workOrderId}/mobile?tab=details`
    : `/work_orders/${workOrderId}?tab=details`;

  const loadEntries = useCallback(async () => {
    if (!workOrderId) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchDebriefingEntries(workOrderId));
    } catch (err) {
      setError(err.message || 'Failed to load debriefing log');
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const orderLabel = workOrder?.order_number ? `#${workOrder.order_number}` : 'Work Order';
  const clientLabel =
    workOrder?.client?.company_name
    || workOrder?.client_name
    || [workOrder?.client?.first_name, workOrder?.client?.last_name].filter(Boolean).join(' ')
    || null;

  if (woLoading) {
    return (
      <WorkOrderMobileShell title="Debriefing" pageTitle="Debriefing | Atomic Repair" backHref={backHref} scanKey="wo-debriefing">
        <div className="py-10 flex justify-center">
          <LoadingSpinner size="large" />
        </div>
      </WorkOrderMobileShell>
    );
  }

  if (woError) {
    return (
      <WorkOrderMobileShell title="Debriefing" pageTitle="Debriefing | Atomic Repair" backHref={backHref} scanKey="wo-debriefing">
        <ErrorAlert message="Failed to load work order" onRetry={() => router.reload()} />
      </WorkOrderMobileShell>
    );
  }

  return (
    <>
      <Head>
        <style>{`
          @media print {
            body { background: #fff !important; color: #000 !important; }
            .debriefing-no-print { display: none !important; }
            .debriefing-print-only { display: block !important; }
            .debriefing-print-body {
              background: #fff !important;
              color: #000 !important;
              padding: 0 !important;
            }
            .min-h-screen,
            .hud-tactical-column {
              background: #fff !important;
              min-height: auto !important;
              padding: 0 !important;
            }
            .pb-28 { padding-bottom: 0 !important; }
            .hud-tactical-column > .pointer-events-none,
            .hud-grid-content > div:first-child {
              display: none !important;
            }
            .hud-grid-content {
              padding: 0 !important;
            }
          }
          .debriefing-print-only { display: none; }
        `}</style>
      </Head>

      <WorkOrderMobileShell
        title="Debriefing"
        pageTitle={`Debriefing ${orderLabel} | Atomic Repair`}
        subtitle={orderLabel}
        backHref={backHref}
        scanKey="wo-debriefing"
        syncKey={workOrder?.id}
      >
        <div className="debriefing-print-body space-y-4 pb-8">
          <div className="debriefing-print-only mb-6">
            <h1 className="text-xl font-bold text-black">Work Order Debriefing</h1>
            <p className="text-sm text-gray-700 mt-1">{orderLabel}{clientLabel ? ` · ${clientLabel}` : ''}</p>
            <p className="text-xs text-gray-500 mt-1">
              Printed {new Date().toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}
            </p>
          </div>

          <div className="debriefing-no-print flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <BriefcaseIcon className="h-5 w-5 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">Activity log</p>
                {clientLabel && (
                  <p className="text-xs text-gray-500 truncate">{clientLabel}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadEntries}
                disabled={loading}
                className="h-9 px-3 rounded-lg border border-white/15 text-xs font-medium text-gray-300 disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-9 px-3 rounded-lg border border-cyan-500/35 text-xs font-semibold uppercase tracking-wide text-cyan-300 inline-flex items-center gap-1.5"
              >
                <FaPrint className="h-3.5 w-3.5" />
                Print
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 print:border-0 print:bg-transparent print:px-0">
            <DebriefingList entries={entries} loading={loading} error={error} isMobile />
          </div>

          <div className="debriefing-no-print pt-2">
            <Link
              href={backHref}
              className="text-xs font-medium text-cyan-400/90 hover:text-cyan-300"
            >
              ← Back to work order details
            </Link>
          </div>
        </div>
      </WorkOrderMobileShell>
    </>
  );
}
