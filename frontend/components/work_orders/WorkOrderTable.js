import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';
import { FaTrash, FaEdit, FaEye } from 'react-icons/fa';
import StatusBadge from '../ui/StatusBadge';
import Modal from '../ui/Modal';
import { useUserRole } from '../../utils/auth0-helpers';
import { useWorkOrderMutations } from '../../hooks/useWorkOrders';
import { getEquipmentIconKey } from '../../utils/equipment-icon-key';

// ── Appliance icons ────────────────────────────────────────────────────────
const APPLIANCE_ICONS = {
  refrigerator:   { color: 'cyan',   svg: (<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/></>) },
  washingmachine: { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/></>) },
  dryer:          { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M10 11a2 2 0 0 0 4 0"/><circle cx="8" cy="6" r="1"/></>) },
  dishwasher:     { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="9" y1="5" x2="15" y2="5"/></>) },
  oven:           { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="10" width="12" height="9" rx="1"/><line x1="7" y1="6" x2="7" y2="6"/><line x1="10" y1="6" x2="10" y2="6"/><line x1="13" y1="6" x2="13" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/></>) },
  microwave:      { color: 'orange', svg: (<><rect x="2" y="6" width="20" height="12" rx="2"/><rect x="4" y="8" width="12" height="8"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="18" y1="14" x2="18" y2="14"/></>) },
  freezer:        { color: 'cyan',   svg: (<><rect x="3" y="6" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/></>) },
  cooktop:        { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/></>) },
  rangehood:      { color: 'orange', svg: (<><path d="M6 3h12l2 7H4L6 3z"/><rect x="4" y="10" width="16" height="4" rx="1"/><line x1="8" y1="14" x2="8" y2="21"/><line x1="16" y1="14" x2="16" y2="21"/></>) },
  tv:             { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></>) },
  default:        { color: 'cyan',   svg: (<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>) },
};

function ApplianceIcon({ equipmentType, equipmentSubtype }) {
  const key = getEquipmentIconKey(equipmentType, equipmentSubtype);
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" style={{
      stroke: isCyan ? '#00D4FF' : '#FF7A00', strokeWidth: 1.5, fill: 'none',
      strokeLinecap: 'round', strokeLinejoin: 'round',
      filter: isCyan ? 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' : 'drop-shadow(0 0 6px rgba(255,122,0,0.6))'
    }}>{match.svg}</svg>
  );
}

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
      <div className="md:hidden space-y-2">
        {workOrders.map((wo) => {
          const client = clientName(wo);
          const date = schedDate(wo);
          const equipLabel = [wo.equipment_make, wo.equipment_model].filter(Boolean).join(' ') || (wo.equipment_type || '').replace(/_/g, ' ') || 'Unknown appliance';
          return (
            <Link
              key={wo.id}
              href={`/work_orders/${wo.id}`}
              className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#0D1525] border border-white/10 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex-shrink-0 w-14 h-14 rounded-xl border border-white/10 flex items-center justify-center" style={{ background: '#0e121b' }}>
                <ApplianceIcon equipmentType={wo.equipment_type} equipmentSubtype={wo.equipment_subtype} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="text-sm font-bold text-cyan-400">{wo.order_number}</span>
                  <StatusBadge status={wo.status} />
                </div>
                <p className="text-sm font-medium text-white truncate">{client}</p>
                <p className="text-xs text-gray-400 truncate">{equipLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">{date}</p>
                {wo.description && <p className="text-xs text-gray-500 truncate mt-0.5">{wo.description}</p>}
              </div>
              <div className="flex-shrink-0 text-gray-600 text-xl">›</div>
            </Link>
          );
        })}
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
