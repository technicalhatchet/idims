import Link from 'next/link';
import { format } from 'date-fns';
import StatusBadge from '@/components/ui/StatusBadge';

export default function WorkOrderTable({ workOrders }) {
  if (!workOrders || workOrders.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No work orders found.
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Order #
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Service
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Technician
            </th>
			<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {workOrders.map((workOrder) => (
            <tr key={workOrder.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                <Link href={`/work-orders/${workOrder.id}`}>
                  {workOrder.order_number}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {workOrder.client?.company_name || 
                 `${workOrder.client?.first_name} ${workOrder.client?.last_name}`}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {workOrder.title}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {workOrder.scheduled_start ? 
                  format(new Date(workOrder.scheduled_start), 'MMM d, yyyy h:mm a') : 
                  'Not scheduled'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {workOrder.technician?.name || 'Unassigned'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={workOrder.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link href={`/work-orders/${workOrder.id}`} className="text-blue-600 hover:text-blue-900 mr-3">
                  View
                </Link>
                <Link href={`/work-orders/${workOrder.id}/edit`} className="text-indigo-600 hover:text-indigo-900">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}