import { useRouter } from 'next/router';
import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaEdit, FaPrint, FaEllipsisH, FaExclamationTriangle } from 'react-icons/fa';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useWorkOrder, useWorkOrderMutations } from '@/hooks/useWorkOrders';

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
      router.push('/work-orders');
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
            
            <Link href={`/work-orders/${id}/edit`} className="btn-primary flex items-center">
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
                {workOrder.timeline.map((event, index) => (
                  <li key={index} className="mb-10 ml-6">
                    <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">
                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                      </svg>
                    </span>
                    <h3 className="flex items-center mb-1 text-lg font-semibold text-gray-900">
                      {event.type === 'creation' && 'Work Order Created'}
                      {event.type === 'scheduled' && 'Scheduled'}
                      {event.type === 'status_change' && `Status Changed: ${event.data.from_status} → ${event.data.to_status}`}
                      {event.type === 'note' && 'Note Added'}
                    </h3>
                    <time className="block mb-2 text-sm font-normal leading-none text-gray-400">
                      {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                    </time>
                    {event.data?.notes && <p className="mb-4 text-base font-normal text-gray-500">{event.data.notes}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500">No activity recorded yet.</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Work Order"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="mr-3"
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
          </>
        }
      >
        <div className="flex items-start">
          <div className="mr-3 flex-shrink-0">
            <FaExclamationTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-gray-500">
              Are you sure you want to delete work order <strong>{workOrder.order_number}</strong>? This action cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
      
      {/* Status Update Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Work Order Status"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setShowStatusModal(false)}
              className="mr-3"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleStatusUpdate}
              isLoading={isMutating}
              disabled={!newStatus || isMutating}
            >
              Update Status
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectInput
            label="New Status"
            id="new-status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'on_hold', label: 'On Hold' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' }
            ]}
            required
          />
          
          <TextareaInput
            label="Notes (Optional)"
            id="status-notes"
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            rows={3}
            placeholder="Add notes about this status change"
          />
        </div>
      </Modal>
    </>
  );
}

WorkOrderDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default WorkOrderDetail;

// FILE: src/services/api/workOrdersApi.js - Complete implementation
import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get work orders with pagination and filters
 */
export async function getWorkOrders(params = {}) {
  const { page = 1, limit = 10, status, client_id, technician_id, start_date, end_date } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (status) queryParams.append('status', status);
  if (client_id) queryParams.append('client_id', client_id);
  if (technician_id) queryParams.append('technician_id', technician_id);
  if (start_date) queryParams.append('start_date', start_date);
  if (end_date) queryParams.append('end_date', end_date);
  
  return apiClient(`${API_URL}/api/work-orders?${queryParams.toString()}`);
}

/**
 * Get a specific work order by ID
 */
export async function getWorkOrder(id) {
  return apiClient(`${API_URL}/api/work-orders/${id}`);
}

/**
 * Create a new work order
 */
export async function createWorkOrder(workOrderData) {
  return apiClient(`${API_URL}/api/work-orders`, {
    method: 'POST',
    body: JSON.stringify(workOrderData),
  });
}

/**
 * Update an existing work order
 */
export async function updateWorkOrder(id, workOrderData) {
  return apiClient(`${API_URL}/api/work-orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(workOrderData),
  });
}

/**
 * Delete a work order
 */
export async function deleteWorkOrder(id) {
  const response = await apiClient(`${API_URL}/api/work-orders/${id}`, {
    method: 'DELETE',
  });
  
  return response === null; // 204 No Content
}

/**
 * Update work order status
 */
export async function updateWorkOrderStatus(id, status, notes) {
  return apiClient(`${API_URL}/api/work-orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes }),
  });
}

/**
 * Assign work order to technician
 */
export async function assignWorkOrder(id, technicianId) {
  return apiClient(`${API_URL}/api/work-orders/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ technician_id: technicianId }),
  });
}

/**
 * Get work order timeline
 */
export async function getWorkOrderTimeline(id) {
  return apiClient(`${API_URL}/api/work-orders/${id}/timeline`);
}

// FILE: src/services/api/clientsApi.js - Complete implementation
import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get clients with pagination and search
 */
export async function getClients(params = {}) {
  const { page = 1, limit = 10, search } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (search) queryParams.append('search', search);
  
  return apiClient(`${API_URL}/api/clients?${queryParams.toString()}`);
}

/**
 * Get a specific client by ID
 */
export async function getClient(id) {
  return apiClient(`${API_URL}/api/clients/${id}`);
}

/**
 * Create a new client
 */
export async function createClient(clientData) {
  return apiClient(`${API_URL}/api/clients`, {
    method: 'POST',
    body: JSON.stringify(clientData),
  });
}

/**
 * Update an existing client
 */
export async function updateClient(id, clientData) {
  return apiClient(`${API_URL}/api/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(clientData),
  });
}

/**
 * Delete a client
 */
export async function deleteClient(id) {
  const response = await apiClient(`${API_URL}/api/clients/${id}`, {
    method: 'DELETE',
  });
  
  return response === null; // 204 No Content
}

/**
 * Get client service history
 */
export async function getClientServiceHistory(id) {
  return apiClient(`${API_URL}/api/clients/${id}/service-history`);
}

// FILE: src/services/api/notificationsApi.js - Complete implementation
import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get notifications
 */
export async function getNotifications(params = {}) {
  const { page = 1, limit = 20, is_read } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (is_read !== undefined) queryParams.append('is_read', is_read);
  
  return apiClient(`${API_URL}/api/notifications?${queryParams.toString()}`);
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(id) {
  return apiClient(`${API_URL}/api/notifications/${id}/read`, {
    method: 'PUT',
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  return apiClient(`${API_URL}/api/notifications/read-all`, {
    method: 'PUT',
  });
}

/**
 * Send custom notification
 */
export async function sendCustomNotification(notificationData) {
  return apiClient(`${API_URL}/api/notifications/send`, {
    method: 'POST',
    body: JSON.stringify(notificationData),
  });
}