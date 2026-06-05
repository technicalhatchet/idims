import { useState } from 'react';
import Link from 'next/link';
import { FaRedo } from 'react-icons/fa';
import Button from '../ui/Button';
import WorkOrderCloseModal from './WorkOrderCloseModal';
import { reopenWorkOrder } from '../../services/api/workOrdersApi';
import { getUserRole } from '../../utils/auth0-helpers';

export default function WorkOrderLifecycleBar({
  workOrder,
  workOrderId,
  user,
  onRefresh,
  variant = 'desktop',
}) {
  const isMobile = variant === 'mobile';
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const role = user ? getUserRole(user) : null;
  const isManagerOrAdmin = role === 'admin' || role === 'manager';
  const isTechnician = role === 'technician';
  const canCloseWorkOrder = isManagerOrAdmin || isTechnician;
  const isAdmin = role === 'admin';

  const isClosed = Boolean(workOrder?.is_closed);
  const isRedoChild = Boolean(workOrder?.is_redo);
  const canShowCloseAction = !isClosed && workOrder?.status === 'completed';

  const handleReopen = async () => {
    if (!window.confirm('Reopen this work order for admin edits?')) return;
    setBusy(true);
    setMessage(null);
    try {
      await reopenWorkOrder(workOrderId);
      onRefresh?.();
    } catch (err) {
      setMessage(err.message || 'Reopen failed');
    } finally {
      setBusy(false);
    }
  };

  const hasAdminClosedActions = isClosed && (isAdmin || isManagerOrAdmin);
  const hasIncompleteHint =
    !isClosed && canCloseWorkOrder && workOrder?.status !== 'completed';

  const showLifecycleBar =
    isRedoChild || canShowCloseAction || hasAdminClosedActions || hasIncompleteHint;

  if (!showLifecycleBar) {
    return null;
  }

  const parentWorkOrderHref = workOrder?.parent_work_order_id
    ? `/work_orders/${workOrder.parent_work_order_id}${isMobile ? '/mobile' : ''}`
    : null;

  const shellClass = isMobile
    ? 'mb-4 rounded-xl border border-cyan-500/30 bg-[rgba(5,12,22,.88)] backdrop-blur-md p-4 space-y-3 shadow-[0_0_20px_rgba(0,212,255,.12)]'
    : 'mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 space-y-3';

  const actionsClass = isMobile ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2';
  const hintClass = isMobile
    ? 'text-xs text-gray-400'
    : 'text-xs text-gray-500 dark:text-gray-400';

  return (
    <>
      <div className={shellClass}>
        {isRedoChild && workOrder.parent_order_number && parentWorkOrderHref && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={parentWorkOrderHref}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <FaRedo className="w-3 h-3" />
              Redo of {workOrder.parent_order_number}
            </Link>
          </div>
        )}

        {canCloseWorkOrder && (
          <div className={actionsClass}>
            {canShowCloseAction && (
              <Button
                variant="primary"
                size={isMobile ? 'lg' : 'md'}
                fullWidth={isMobile}
                onClick={() => setShowCloseModal(true)}
                disabled={busy}
              >
                Close order
              </Button>
            )}
            {!isClosed && workOrder.status !== 'completed' && (
              <p className={hintClass}>
                Work order must be <strong className={isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>completed</strong> before you can close it.
              </p>
            )}
            {isClosed && isAdmin && (
              <Button
                variant="secondary"
                size={isMobile ? 'lg' : 'md'}
                fullWidth={isMobile}
                onClick={handleReopen}
                disabled={busy}
              >
                Reopen (admin)
              </Button>
            )}
            {isClosed && isManagerOrAdmin && (
              <Button
                variant="secondary"
                size={isMobile ? 'lg' : 'md'}
                fullWidth={isMobile}
                onClick={() => setShowCloseModal(true)}
                disabled={busy}
              >
                Re-close order
              </Button>
            )}
          </div>
        )}

        {message && (
          <p className={`text-sm ${isMobile ? 'text-cyan-300' : 'text-cyan-700 dark:text-cyan-300'}`}>
            {message}
          </p>
        )}
      </div>

      <WorkOrderCloseModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        workOrderId={workOrderId}
        isClosed={isClosed}
        onSuccess={onRefresh}
        variant={variant}
      />
    </>
  );
}
