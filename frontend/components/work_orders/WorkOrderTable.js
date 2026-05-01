import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { FaTrash, FaEdit, FaEye, FaWrench, FaUser, FaCalendar } from 'react-icons/fa';
import StatusBadge from '../ui/StatusBadge';
import Modal from '../ui/Modal';
import { useUserRole } from '../../utils/auth0-helpers';
import { useWorkOrderMutations } from '../../hooks/useWorkOrders';

export default function WorkOrderTable({ workOrders }) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [workOrderToDelete, setWorkOrderToDelete] = useState(null);
  const { isAdmin } = useUserRole();
  const { deleteWorkOrder, isLoading } = useWorkOrderMutations();

  const handleDelete = async () => {
    try {
      await deleteWorkOrder(workOrderToDelete.id);
      setDeleteModalOpen(false);
      setWorkOrderToDelete(null);
    } catch (error) {
      console.error('Error deleting work order:', error);
      alert('Failed to delete work order. Please try again.');
    }
  };

  const openDeleteModal = (workOrder) => {
    setWorkOrderToDelete(workOrder);
    setDeleteModalOpen(true);
  };

  if (!workOrders || workOrders.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        No work orders found.
      </div>
    );
  }

  const clientName = (wo) =>
    wo.client?.company_name || wo.client_name ||
    `${wo.client?.first_name || ''} ${wo.client?.last_name || ''}`.trim() ||
    'No client';

  const techName = (wo) => wo.technician?.name || wo.technician_name || 'Unassigned';

  const schedDate = (wo) =>
    wo.scheduled_start
      ? format(new Date(wo.scheduled_start.endsWith('Z') ? wo.scheduled_start : wo.scheduled_start + 'Z'), 'MMM d, yyyy h:mm a')
      : 'Not scheduled';

  return (
    <>
      {/* ── MOBILE CARDS ── */}
      <div className="md:hidden space-y-3">
        {workOrders.map((wo) => (
          <Link
            key={wo.id}
            href={`/work_orders/${wo.id}`}
            className="block bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            {/* Top row: order number + status */}
            <div className="flex justify-between items-start mb-2">
              <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                {wo.order_number}
              </span>
              <StatusBadge status={wo.status} />
            </div>

            {/* Description */}
            {wo.description && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">
                {wo.description}
              </p>
            )}

            {/* Meta rows */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <FaUser className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{clientName(wo)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <FaWrench className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{techName(wo)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <FaCalendar className="h-3 w-3 flex-shrink-0" />
                <span>{schedDate(wo)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <Link
                href={`/work_orders/${wo.id}/edit`}
                onClick={e => e.stopPropagation()}
                className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md"
              >
                Edit
              </Link>
              {isAdmin && (
                <button
                  onClick={e => { e.preventDefault(); openDeleteModal(wo); }}
                  className="text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md"
                >
                  Delete
                </button>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Technician</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
            {workOrders.map((wo) => (
              <tr key={wo.id} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                  <Link href={`/work_orders/${wo.id}`}>{wo.order_number}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{clientName(wo)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{schedDate(wo)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{techName(wo)}</td>
                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={wo.status} /></td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center space-x-3">
                    <Link href={`/work_orders/${wo.id}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-900" title="View"><FaEye /></Link>
                    <Link href={`/work_orders/${wo.id}/edit`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900" title="Edit"><FaEdit /></Link>
                    {isAdmin && (
                      <button onClick={() => openDeleteModal(wo)} className="text-red-600 dark:text-red-400 hover:text-red-900" title="Delete">
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirm Delete">
        <div className="p-6">
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Are you sure you want to delete work order{' '}
            <span className="font-semibold">{workOrderToDelete?.order_number}</span>? This action cannot be undone.
          </p>
          <div className="mt-6 flex justify-end space-x-3">
            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">
              Cancel
            </button>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700" disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
