import { useRouter } from 'next/router';
import { useState } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaEdit, FaPrint, FaEllipsisH, FaExclamationTriangle } from 'react-icons/fa';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import StatusBadge from '../../../components/ui/StatusBadge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useWorkOrder, useWorkOrderMutations } from '../../../hooks/useWorkOrders';
import { apiClient } from '../../../utils/api-client';

function WorkOrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  
  // Fetch work order details
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  
  // Work order mutations
  const { 
    deleteWorkOrder, 
    updateWorkOrderStatus, 
    isLoading: isMutating 
  } = useWorkOrderMutations();
  
  // Handle work order deletion
  const handleDelete = async () => {
    try {
      await deleteWorkOrder(id);
      router.push('/work_orders');
    } catch (error) {
      console.error('Error deleting work order:', error);
      // Error is shown by the mutation hook
    }
  };
  
  // Handle status update
  const handleStatusUpdate = async () => {
    try {
      await updateWorkOrderStatus({
        id,
        status: newStatus,
        notes: statusNotes
      });
      setShowStatusModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
      // Error is shown by the mutation hook
    }
  };
  
  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <ErrorAlert 
          message="Failed to load work order details" 
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{workOrder.order_number} | Work Order | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6">
          <div>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold mr-3">Work Order: {workOrder.order_number}</h1>
              <StatusBadge status={workOrder.status} />
            </div>
            <p className="text-gray-500 mt-1">Created on {format(new Date(workOrder.created_at), 'MMMM d, yyyy')}</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex space-x-2">
            <div className="relative inline-block text-left">
              <Button
                variant="outline"
                onClick={() => setShowStatusModal(true)}
              >
                Update Status
              </Button>
            </div>
            
            <Link href={`/work_orders/${id}/edit`} className="btn-primary flex items-center">
              <FaEdit className="mr-2" />
              Edit
            </Link>
            
            <div className="relative">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-danger flex items-center"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
        
        {/* Work Order Detail Card */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Work Order Details</h2>
          </div>
          
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Client</h3>
                <p className="mt-1 text-sm text-gray-900">{workOrder.client?.company_name || 
                  `${workOrder.client?.first_name} ${workOrder.client?.last_name}`}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Title</h3>
                <p className="mt-1 text-sm text-gray-900">{workOrder.title}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Scheduled Time</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {workOrder.scheduled_start ? 
                    format(new Date(workOrder.scheduled_start), 'MMM d, yyyy h:mm a') : 
                    'Not scheduled'}
                  {workOrder.scheduled_end && 
                    ` - ${format(new Date(workOrder.scheduled_end), 'h:mm a')}`}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Technician</h3>
                <p className="mt-1 text-sm text-gray-900">{workOrder.technician?.name || 'Unassigned'}</p>
              </div>
              			<div>
                <h3 className="text-sm font-medium text-gray-500">Priority</h3>
                <p className="mt-1 text-sm text-gray-900 capitalize">{workOrder.priority}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Service Location</h3>
                <p className="mt-1 text-sm text-gray-900">{workOrder.service_location?.address || 'No location specified'}</p>
              </div>
              
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">{workOrder.description || 'No description provided'}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Services and Items */}
        {(workOrder.services?.length > 0 || workOrder.items?.length > 0) && (
          <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Services & Items</h2>
            </div>
            
            <div className="px-6 py-5">
              {workOrder.services?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Services</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {workOrder.services.map((service) => (
                          <tr key={service.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.quantity}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.price.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(service.quantity * service.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {workOrder.items?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {workOrder.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.price.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(item.quantity * item.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Activity Timeline */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Activity Timeline</h2>
          </div>
          
          <div className="px-6 py-5">
            {workOrder.timeline?.length > 0 ? (
              <ol className="relative border-l border-gray-200 ml-3">
                {workOrder.timeline.map((activity) => (
                  <li key={activity.id} className="mb-10 ml-6">
                    <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">
                      {/* Icon based on activity type */}
                      <svg className="w-3 h-3 text-blue-800" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                      </svg>
                    </span>
                    <h3 className="flex items-center mb-1 text-lg font-semibold text-gray-900">
                      {activity.title}
                      {activity.is_important && (
                        <span className="bg-red-100 text-red-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded ml-3">
                          Important
                        </span>
                      )}
                    </h3>
                    <time className="block mb-2 text-sm font-normal leading-none text-gray-400">
                      {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                    </time>
                    <p className="mb-4 text-base font-normal text-gray-500">{activity.description}</p>
                    {activity.user && (
                      <p className="text-sm text-gray-400">By: {activity.user.name}</p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500 text-center py-4">No activity recorded yet.</p>
            )}
          </div>
        </div>
        
        {/* Delete confirmation modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Work Order"
        >
          <div className="p-6">
            <div className="flex items-center mb-4 text-red-600">
              <FaExclamationTriangle className="text-xl mr-2" />
              <h3 className="text-lg font-medium">Are you sure you want to delete this work order?</h3>
            </div>
            <p className="mb-6 text-gray-500">
              This action cannot be undone. This will permanently delete the work order
              <strong> {workOrder.order_number}</strong> and all associated data.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={isMutating}
                disabled={isMutating}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
        
        {/* Status update modal */}
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title="Update Work Order Status"
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Status
              </label>
              <select
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="">Select a status</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={3}
                placeholder="Add notes about this status change"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowStatusModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleStatusUpdate}
                isLoading={isMutating}
                disabled={isMutating || !newStatus}
              >
                Update Status
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}

WorkOrderDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

// Server-side authentication check
export async function getServerSideProps(context) {
  // Get the ID from the URL
  const { id } = context.params;
  
  // Check authentication
  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }
  
  // Return the ID as a prop so it's available during initial render
  return {
    props: {
      id,
    },
  };
}

export default WorkOrderDetail;