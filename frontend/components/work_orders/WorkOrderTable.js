import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { FaTrash, FaEdit, FaEye } from 'react-icons/fa';
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
  
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Order #
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Client
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Technician
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
            {workOrders.map((workOrder) => (
              <tr key={workOrder.id} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                  <Link href={`/work_orders/${workOrder.id}`}>
                    {workOrder.order_number}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                  {workOrder.client?.company_name || workOrder.client_name || 
                  `${workOrder.client?.first_name || ''} ${workOrder.client?.last_name || ''}`.trim() || 
                  'No client assigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {workOrder.scheduled_start ? 
                    format(new Date(workOrder.scheduled_start), 'MMM d, yyyy h:mm a') : 
                    'Not scheduled'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {workOrder.technician?.name || workOrder.technician_name || 'Unassigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={workOrder.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center space-x-3">
                    <Link href={`/work_orders/${workOrder.id}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300" title="View">
                      <FaEye />
                    </Link>
                    <Link href={`/work_orders/${workOrder.id}/edit`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300" title="Edit">
                      <FaEdit />
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => openDeleteModal(workOrder)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        title="Delete"
                      >
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
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete"
      >
        <div className="p-6">
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Are you sure you want to delete work order{' '}
            <span className="font-semibold">
              {workOrderToDelete?.order_number}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}