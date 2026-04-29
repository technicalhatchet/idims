import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import { useUser } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaEdit, FaPrint, FaEllipsisH, FaExclamationTriangle, FaCalendarAlt, FaClipboardList, FaToolbox, FaUserAlt, FaFileInvoiceDollar } from 'react-icons/fa';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import StatusBadge from '../../../components/ui/StatusBadge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useWorkOrder, useWorkOrderMutations } from '../../../hooks/useWorkOrders';
import { apiClient } from '../../../utils/api-client';
import { useTheme } from '../../../context/ThemeContext';
import AppointmentScheduler from '../../../components/work_orders/AppointmentScheduler';
import WorkOrderNotes from '../../../components/work_orders/WorkOrderNotes';
import EquipmentDetails from '../../../components/work_orders/EquipmentDetails';

// Tabs for the detail page
const TABS = {
  DETAILS: 'details',
  APPOINTMENTS: 'appointments',
  NOTES: 'notes',
  MODEL: 'model',
  CLIENT: 'client',
  INVOICES: 'invoices'
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function WorkOrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [activeTab, setActiveTab] = useState(
    router.query.tab === 'appointments' ? TABS.APPOINTMENTS :
    router.query.tab === 'details' ? TABS.DETAILS :
    TABS.DETAILS
  );
  const [statusModalError, setStatusModalError] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isApplyingPayment, setIsApplyingPayment] = useState(false);
  const [clientWorkOrders, setClientWorkOrders] = useState([]);
  const [clientWorkOrdersLoading, setClientWorkOrdersLoading] = useState(false);
  const [halfDiagnosticDiscount, setHalfDiagnosticDiscount] = useState(false);
  const [editingServicePrice, setEditingServicePrice] = useState(null); // { id, price, unit_price, name }
  const [editingPartPrice, setEditingPartPrice] = useState(null); // { id, price, cost }
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const { theme } = useTheme();
  
  // Ensure dark mode applies correctly on page load
  useEffect(() => {
    // Apply the theme from context to the document
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.mode]);

  // Fetch work order details
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);

  // Services come directly from the work order
  const allServices = workOrder?.services || [];
  
  // Handle payment success/cancel URLs
  useEffect(() => {
    const { payment } = router.query;
    
    if (payment === 'success') {
      // Show success message and refresh work order data
      alert('Payment successful! Your work order has been updated.');
      refetch(); // Refresh the work order data
      
      // Remove the payment parameter from URL
      router.replace(`/work-orders/${id}`, undefined, { shallow: true });
    } else if (payment === 'cancelled') {
      // Show cancellation message
      alert('Payment was cancelled. You can try again anytime.');
      
      // Remove the payment parameter from URL
      router.replace(`/work-orders/${id}`, undefined, { shallow: true });
    }
  }, [router.query, router, id, refetch]);
  
    // Debug logs to check the work order data structure
  console.log('Work order data received:', workOrder);
  if (workOrder) {
    console.log('Services billing status:', workOrder.services?.map(s => ({ name: s.name, billing_status: s.billing_status, price: s.price })));
    console.log('Client data:', {
      client_name: workOrder.client_name,
      client: workOrder.client,
      client_object: typeof workOrder.client === 'object' ? workOrder.client : 'Not an object'
    });
    console.log('Technician data full:', workOrder.technician);
    console.log('Technician data fields:', {
      technician_name: workOrder.technician_name,
      technician_id: workOrder.technician_id,
      assigned_technician_id: workOrder.assigned_technician_id,
      technician: workOrder.technician
    });

  }
  
  // Sync tab from URL query param (router.query is empty on first render)
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.tab === 'appointments') setActiveTab(TABS.APPOINTMENTS);
    else if (router.query.tab === 'details') setActiveTab(TABS.DETAILS);
  }, [router.isReady, router.query.tab]);

  // Fetch client's other work orders when Client tab is active
  useEffect(() => {
    if (activeTab === TABS.CLIENT && workOrder?.client_id && clientWorkOrders.length === 0) {
      setClientWorkOrdersLoading(true);
      apiClient(`work-orders?client_id=${workOrder.client_id}&limit=50`)
        .then(res => {
          const items = res?.items || [];
          // Exclude the current work order
          setClientWorkOrders(items.filter(wo => wo.id !== workOrder.id));
        })
        .catch(err => console.error('Error fetching client work orders:', err))
        .finally(() => setClientWorkOrdersLoading(false));
    }
  }, [activeTab, workOrder?.client_id]);

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
      if (!workOrder?.id) {
        console.error('Work order ID is not available');
        return;
      }
      
      await updateWorkOrderStatus({
        id: workOrder.id,
        status: newStatus,
        notes: statusNotes
      });
      setShowStatusModal(false);
      refetch(); // Refresh the work order data
    } catch (error) {
      console.error('Error updating status:', error);
      // Error is shown by the mutation hook
    }
  };

  // Handle payment collection
  const handleApplyPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setIsApplyingPayment(true);
    try {
      const response = await fetch(`/api/work-orders/${id}/admin-override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          action: 'apply_payment',
          payment_amount: parseFloat(paymentAmount)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to apply payment');
      }

      // Clear the payment amount and refresh the work order
      setPaymentAmount('');
      refetch();
      alert('Payment applied successfully!');
    } catch (error) {
      console.error('Error applying payment:', error);
      alert('Failed to apply payment: ' + error.message);
    } finally {
      setIsApplyingPayment(false);
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
              <h1 className="text-2xl font-bold mr-3 text-gray-900 dark:text-white">Work Order: {workOrder.order_number}</h1>
              <StatusBadge status={workOrder.status} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Created on {format(new Date(workOrder.created_at), 'MMMM d, yyyy')}</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
            <Link href={`/work_orders/${id}/edit`} className="btn-primary flex items-center" title="Edit work order">
              <FaEdit className="mr-2" />
              Edit
            </Link>
            <button onClick={() => window.print()} className="btn-white flex items-center" title="Print work order">
              <FaPrint className="mr-2" />
              Print
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowStatusModal(true)} 
                className="btn-secondary flex items-center"
                title="Update status"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
        
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab(TABS.DETAILS)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === TABS.DETAILS
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FaClipboardList className="inline-block mr-2" />
              Details
            </button>
            
            <button
              onClick={() => setActiveTab(TABS.APPOINTMENTS)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === TABS.APPOINTMENTS
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FaCalendarAlt className="inline-block mr-2" />
              Appointments
            </button>
            
            <button
              onClick={() => setActiveTab(TABS.NOTES)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === TABS.NOTES
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FaClipboardList className="inline-block mr-2" />
              Notes
            </button>
            
            <button
              onClick={() => setActiveTab(TABS.MODEL)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === TABS.MODEL
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FaToolbox className="inline-block mr-2" />
              Model
            </button>
            
            <button
              onClick={() => setActiveTab(TABS.CLIENT)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === TABS.CLIENT
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FaUserAlt className="inline-block mr-2" />
              Client
            </button>
            
            <button
              onClick={() => setActiveTab(TABS.INVOICES)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === TABS.INVOICES
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <FaFileInvoiceDollar className="inline-block mr-2" />
              Invoices
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div>
          {/* Details Tab */}
          {activeTab === TABS.DETAILS && (
            <>
              {/* Work Order Detail Card */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Work Order Details</h2>
                </div>
                
                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Client</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {workOrder.client?.company_name || workOrder.client_name || 
                        `${workOrder.client?.first_name || ''} ${workOrder.client?.last_name || ''}`.trim() || 
                        'No client assigned'}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Title</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{workOrder.title}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled Time</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white flex items-center">
                        {workOrder.scheduled_start ? (
                          <>
                            <span className="mr-2 inline-block w-2 h-2 rounded-full bg-green-500"></span>
                            {format(new Date(workOrder.scheduled_start), 'MMM d, yyyy h:mm a')}
                            {workOrder.scheduled_end && 
                              ` - ${format(new Date(workOrder.scheduled_end), 'h:mm a')}`}
                          </>
                        ) : (
                          <>
                            <span className="mr-2 inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                            Not scheduled
                          </>
                        )}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{workOrder.priority}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Location</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{workOrder.service_location?.address || 'No location specified'}</p>
                    </div>
                    
                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-line">{workOrder.description || 'No description provided'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Schedule Information */}
              {workOrder.scheduled_start && (
                <div className="mb-6">
                  <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule Information</h3>
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                    <div className="px-6 py-4">
                      <div className="mb-4">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span className="font-medium mr-2">Primary Schedule:</span>
                          <span>
                            {new Date(workOrder.scheduled_start).toLocaleDateString()} {new Date(workOrder.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {workOrder.scheduled_end && (
                              <span> - {new Date(workOrder.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          This is the overall scheduled time period for this work order.
                        </p>
                        
                        {/* Show a button to view all appointments if they exist */}
                        {workOrder.appointments && workOrder.appointments.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setActiveTab(TABS.APPOINTMENTS)}
                              className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View All {workOrder.appointments.length} Appointment{workOrder.appointments.length !== 1 ? 's' : ''}
                            </button>
                          </div>
                        )}
                      </div>
                        
                      {/* Display Individual Appointments Summary */}
                      {workOrder.appointments && workOrder.appointments.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Related Appointments</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {workOrder.appointments.map((appointment, index) => (
                              <div 
                                key={index}
                                className="p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-650 cursor-pointer"
                                onClick={() => setActiveTab(TABS.APPOINTMENTS)}
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                      {appointment.appointment_type.charAt(0).toUpperCase() + appointment.appointment_type.slice(1)}
                                      {appointment.services?.length > 0 && (
                                        <span className="ml-2 text-xs text-cyan-500 dark:text-cyan-400 font-normal">
                                          — {appointment.services.map(s => s.name).join(', ')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                      {new Date(appointment.scheduled_start).toLocaleDateString()} {new Date(appointment.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {appointment.scheduled_end && (
                                        <span> - {new Date(appointment.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      )}
                                    </div>
                                    {appointment.notes && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                                        {appointment.notes}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                      appointment.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      appointment.status === 'canceled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      appointment.status === 'reschedule' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    }`}>
                                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                    </span>
                                  </div>
                                </div>
                                {appointment.assigned_technician_id && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Technician: {appointment.technician_name || "Unassigned"}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Services and Items */}
              {(allServices?.length > 0 || workOrder.parts?.length > 0) && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
                  <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">Services & Items</h2>
                  </div>
                  
                  <div className="px-6 py-5">
                    {/* Services */}
                    {allServices?.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Services</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {allServices.map((service, index) => (
                                <tr key={service.id || index}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{service.name || 'Unknown Service'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{service.quantity}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${service.unit_price ? Number(service.unit_price).toFixed(2) : 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${service.price ? Number(service.price).toFixed(2) : 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {/* Parts */}
                    {workOrder.parts?.length > 0 && (
                      <div>
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Parts</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Part Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {workOrder.parts.map((part) => (
                                <tr key={part.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{part.number}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{part.description}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${part.cost ? part.cost.toFixed(2) : 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${part.price ? part.price.toFixed(2) : 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{part.vendor || 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      part.status === 'installed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      part.status === 'received' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                      part.status === 'ordered' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                    }`}>
                                      {part.status}
                                    </span>
                                  </td>
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
            </>
          )}
          
          {/* Appointments Tab */}
          {activeTab === TABS.APPOINTMENTS && (
            <>
              <AppointmentScheduler 
                workOrderId={id} 
                workOrderAddress={workOrder.service_location?.address}
                key={`appointments-${id}`}
                onAppointmentChange={() => {
                  console.log("Appointment changed, refreshing work order data");
                  refetch(); // Refresh the work order details to get updated schedule
                }}
              />
            </>
          )}
          
          {/* Notes Tab */}
          {activeTab === TABS.NOTES && (
            <div className="p-6">
              <WorkOrderNotes workOrderId={workOrder.id} />
            </div>
          )}
          
          {/* Model Tab */}
          {activeTab === TABS.MODEL && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Equipment Details</h2>
              </div>
              <div className="px-6 py-5">
                <EquipmentDetails workOrderId={workOrder.id} workOrder={workOrder} onUpdate={refetch} />
              </div>
            </div>
          )}
          
          {/* Client Tab */}
          {activeTab === TABS.CLIENT && (
            <div className="space-y-6">
              {/* Client Info Card */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Client Information</h2>
                </div>
                <div className="px-6 py-5">
                  {workOrder.client_user ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {`${workOrder.client_user.first_name || ''} ${workOrder.client_user.last_name || ''}`.trim() || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Company</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {workOrder.client?.company_name || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {workOrder.client_user.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {workOrder.client_user.phone || workOrder.client?.phone || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                      No client information available.
                    </p>
                  )}
                </div>
              </div>

              {/* Client's Other Work Orders */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Other Work Orders</h2>
                </div>
                <div className="px-6 py-5">
                  {clientWorkOrdersLoading ? (
                    <div className="flex justify-center py-6"><LoadingSpinner /></div>
                  ) : clientWorkOrders.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-6">No other work orders for this client.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {clientWorkOrders.map(wo => (
                            <tr key={wo.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Link href={`/work_orders/${wo.id}?tab=details`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">
                                  {wo.order_number}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                                {wo.description || 'No description'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusBadge status={wo.status} />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {wo.created_at ? format(new Date(wo.created_at), 'MMM d, yyyy') : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Invoices Tab */}
          {activeTab === TABS.INVOICES && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Invoice Details</h2>
                <div className="flex gap-2">
                  {['estimate', 'invoice'].map(type => (
                    <button
                      key={type}
                      onClick={async () => {
                        try {
                          const { getAuthHeaders } = await import('../../../utils/api-client');
                          const headers = await getAuthHeaders();
                          const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://idims-production.up.railway.app').replace(/\/$/, '');
                          const res = await fetch(`${baseUrl}/api/work-orders/${workOrder.id}/${type}.pdf`, { headers });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({ detail: res.statusText }));
                            throw new Error(err.detail || res.statusText);
                          }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        } catch(e) { alert(`Failed to generate ${type}: ` + e.message); }
                      }}
                      className={`px-3 py-1.5 text-sm text-white rounded transition-colors ${
                        type === 'estimate' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      {type === 'estimate' ? '📋 Estimate' : '📄 Invoice'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-6 py-5">
                {(allServices?.length > 0 || workOrder?.parts?.length > 0) ? (
                  <div className="space-y-6">
                    {/* Services Section */}
                    {allServices?.length > 0 && (
                      <div>
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Services</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3"></th>
                                 </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {allServices.map((item, index) => {
                                const isBillable = item.billing_status === 'billable' || item.billing_status === 'paid';
                                const isPaid = item.billing_status === 'paid';
                                const isWaived = item.billing_status === 'waived';
                                const isEditingThis = editingServicePrice?.id === item.id;
                                
                                return (
                                  <tr key={item.service_id || item.id || index} className={isBillable && !isPaid ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                                      {isEditingThis ? (
                                        <input
                                          className="w-full px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingServicePrice.name}
                                          onChange={e => setEditingServicePrice(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                      ) : (
                                        <>
                                          {item.name || 'N/A'}
                                          {isPaid && <span className="ml-2">✓</span>}
                                          {isBillable && !isPaid && <span className="ml-2">💰</span>}
                                        </>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">{item.quantity || 1}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                                      {isEditingThis ? (
                                        <input
                                          type="number" step="0.01" min="0"
                                          className="w-24 px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingServicePrice.unit_price}
                                          onChange={e => setEditingServicePrice(prev => ({ ...prev, unit_price: e.target.value, price: (parseFloat(e.target.value) * (item.quantity || 1)).toFixed(2) }))}
                                        />
                                      ) : (
                                        `${item.unit_price ? item.unit_price.toFixed(2) : '0.00'}`
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100 text-right">
                                      {isEditingThis ? (
                                        <input
                                          type="number" step="0.01" min="0"
                                          className="w-24 px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingServicePrice.price}
                                          onChange={e => setEditingServicePrice(prev => ({ ...prev, price: e.target.value }))}
                                        />
                                      ) : (
                                        `${item.price ? item.price.toFixed(2) : '0.00'}`
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        isBillable ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        isWaived ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      }`}>
                                        {isPaid ? 'Paid' : isBillable ? 'Due Today' : isWaived ? 'Waived' : 'Not Billable'}
                                      </span>
                                    </td>
                                    {/* Admin price edit controls */}
                                    <td className="px-4 py-4 whitespace-nowrap text-right">
                                      {isEditingThis ? (
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            disabled={isSavingPrice}
                                            onClick={async () => {
                                              setIsSavingPrice(true);
                                              try {
                                                await apiClient(`api/work-orders/services/${item.id}/price`, {
                                                  method: 'PUT',
                                                  body: JSON.stringify({
                                                    unit_price: parseFloat(editingServicePrice.unit_price),
                                                    price: parseFloat(editingServicePrice.price),
                                                    name: editingServicePrice.name
                                                  })
                                                });
                                                setEditingServicePrice(null);
                                                refetch();
                                              } catch(e) { alert('Failed to save: ' + e.message); }
                                              finally { setIsSavingPrice(false); }
                                            }}
                                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                          >{isSavingPrice ? '...' : 'Save'}</button>
                                          <button
                                            onClick={() => setEditingServicePrice(null)}
                                            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                          >Cancel</button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setEditingServicePrice({ id: item.id, name: item.name, unit_price: item.unit_price, price: item.price })}
                                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
                                          title="Edit price"
                                        >✏️</button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Parts Section */}
                    {workOrder?.parts?.length > 0 && (
                      <div>
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Parts</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Part Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3"></th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {workOrder.parts.map((part, index) => {
                                const isPhonePayment = part.status === 'phone_payment';
                                const isUpfront50 = part.status === 'upfront_50';
                                const isInstalled = part.status === 'installed';
                                const upfrontCollected = parseFloat(part.amount_upfront_collected || 0);
                                const price = parseFloat(part.price || 0);
                                const remainingDue = isInstalled ? price - upfrontCollected : isUpfront50 ? price * 0.5 : isPhonePayment ? 0 : null;
                                const isBillable = isPhonePayment || isUpfront50 || isInstalled;
                                const isPaid = isPhonePayment;
                                const isPartial = isUpfront50 || (isInstalled && upfrontCollected > 0);
                                
                                return (
                                  <tr key={part.id || index} className={isBillable && !isPaid ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {part.number}
                                      {isPaid && <span className="ml-2">✓</span>}
                                      {isBillable && !isPaid && <span className="ml-2">💰</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                      {part.description}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100 text-right">
                                      {editingPartPrice?.id === part.id ? (
                                        <input
                                          type="number" step="0.01" min="0"
                                          className="w-24 px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingPartPrice.price}
                                          onChange={e => setEditingPartPrice(prev => ({ ...prev, price: e.target.value }))}
                                        />
                                      ) : (
                                        `${price.toFixed(2)}`
                                      )}
                                      {isPartial && upfrontCollected > 0 && (
                                        <div className="text-xs text-gray-400">${upfrontCollected.toFixed(2)} collected</div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        isUpfront50 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                        isInstalled && upfrontCollected > 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        isBillable ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      }`}>
                                        {isPaid ? 'Paid in Full' :
                                         isUpfront50 ? `50% Due (${(price * 0.5).toFixed(2)})` :
                                         isInstalled && upfrontCollected > 0 ? `Balance Due (${remainingDue.toFixed(2)})` :
                                         isInstalled ? 'Due Today' :
                                         'Not Billable'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right">
                                      {editingPartPrice?.id === part.id ? (
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            disabled={isSavingPrice}
                                            onClick={async () => {
                                              setIsSavingPrice(true);
                                              try {
                                                await apiClient(`api/work-orders/parts/${part.id}/price`, {
                                                  method: 'PUT',
                                                  body: JSON.stringify({ price: parseFloat(editingPartPrice.price) })
                                                });
                                                setEditingPartPrice(null);
                                                refetch();
                                              } catch(e) { alert('Failed to save: ' + e.message); }
                                              finally { setIsSavingPrice(false); }
                                            }}
                                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                          >{isSavingPrice ? '...' : 'Save'}</button>
                                          <button
                                            onClick={() => setEditingPartPrice(null)}
                                            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                          >Cancel</button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setEditingPartPrice({ id: part.id, price: price })}
                                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
                                          title="Edit price"
                                        >✏️</button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Invoice Totals */}
                    {(() => {
                      const taxRate = parseFloat(workOrder.tax_rate || 0.0775);
                      const taxPct = (taxRate * 100).toFixed(2);

                      // All services regardless of billing status
                      const servicesSubtotal = (allServices || []).reduce((sum, s) => sum + parseFloat(s.price || 0), 0);

                      // All billable parts (any payment-triggering status)
                      const PART_BILLABLE = ['phone_payment', 'paid_not_installed', 'upfront_50', 'installed'];
                      const partsSubtotal = (workOrder.parts || [])
                        .filter(p => PART_BILLABLE.includes(p.status))
                        .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);

                      const subtotal = servicesSubtotal + partsSubtotal;

                      // Tax only on billable parts
                      const taxOnParts = round2(partsSubtotal * taxRate);
                      const grossTotal = round2(subtotal + taxOnParts);

                      // Diagnostic discount — shown always if repair SKU exists, grayed if repair not yet completed
                      const hasRepairSku = (allServices || []).some(s =>
                        s.name?.toLowerCase().includes('repair') ||
                        s.service_definition?.service_type === 'repair'
                      );
                      const repairCompleted = (workOrder.appointments || []).some(a =>
                        a.appointment_type === 'repair' && a.status === 'completed'
                      );
                      const discountAmt = hasRepairSku && workOrder?.diagnostic_discount_amount > 0
                        ? (halfDiagnosticDiscount
                            ? round2(workOrder.diagnostic_discount_amount * 0.5)
                            : round2(workOrder.diagnostic_discount_amount))
                        : 0;

                      const totalWorkOrder = round2(grossTotal - discountAmt);
                      const previouslyPaid = round2(parseFloat(workOrder.amount_previously_paid || 0));

                      // Due Today = only BILLABLE services + parts due now - previously paid
                      const billableServicesTotal = (allServices || [])
                        .filter(s => s.billing_status === 'billable')
                        .reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
                      const partsDueNow = (workOrder.parts || [])
                        .reduce((sum, p) => {
                          const pr = parseFloat(p.price || 0);
                          const upfront = parseFloat(p.amount_upfront_collected || 0);
                          const taxOnPart = round2(pr * taxRate);
                          if (p.status === 'phone_payment') return sum + pr + taxOnPart;  // collecting now
                          if (p.status === 'upfront_50') return sum + round2(pr * 0.5) + round2(pr * 0.5 * taxRate);
                          if (p.status === 'installed') return sum + round2(pr - upfront) + round2((pr - upfront) * taxRate);
                          if (p.status === 'paid_not_installed') return sum; // already added to previously_paid
                          return sum;
                        }, 0);
                      const dueToday = Math.max(0, round2(billableServicesTotal + partsDueNow - previouslyPaid));

                      return (
                        <>
                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1.5">
                            {/* Tax rate control */}
                            <div className="flex justify-end items-center gap-2 mb-3">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Tax Rate:</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number" step="0.01" min="0" max="20"
                                  className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-right"
                                  defaultValue={taxPct}
                                  onBlur={async (e) => {
                                    const newRate = parseFloat(e.target.value) / 100;
                                    if (isNaN(newRate)) return;
                                    try {
                                      await apiClient(`api/work-orders/${workOrder.id}/tax-rate`, {
                                        method: 'PUT',
                                        body: JSON.stringify({ tax_rate: newRate })
                                      });
                                      refetch();
                                    } catch(err) { alert('Failed to update tax rate'); }
                                  }}
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            </div>

                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                              <span>Services Subtotal</span>
                              <span>${servicesSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                              <span>Parts Subtotal</span>
                              <span>${partsSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-700">
                              <span>Subtotal</span>
                              <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                              <span>Sales Tax ({taxPct}% on parts)</span>
                              <span>${taxOnParts.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-700">
                              <span>Gross Total</span>
                              <span>${grossTotal.toFixed(2)}</span>
                            </div>

                            {/* Diagnostic discount line */}
                            {hasRepairSku && workOrder?.diagnostic_discount_amount > 0 && (
                              <div className={`flex justify-between items-center text-sm ${
                                repairCompleted
                                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                                  : 'text-gray-400 dark:text-gray-500 italic'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <span>
                                    Diagnostic Discount ({halfDiagnosticDiscount ? '50%' : '100%'})
                                    {!repairCompleted && ' — pending repair completion'}
                                  </span>
                                  <label className="flex items-center gap-1 text-xs cursor-pointer not-italic">
                                    <input
                                      type="checkbox"
                                      checked={halfDiagnosticDiscount}
                                      onChange={e => setHalfDiagnosticDiscount(e.target.checked)}
                                      className="rounded"
                                    />
                                    50% only
                                  </label>
                                </div>
                                <span>-${discountAmt.toFixed(2)}</span>
                              </div>
                            )}

                            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-50 pt-1 border-t border-gray-200 dark:border-gray-600">
                              <span>Total Work Order</span>
                              <span>${totalWorkOrder.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                              <span>Amount Previously Paid</span>
                              <span>-${previouslyPaid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-base font-bold text-yellow-600 dark:text-yellow-400 pt-1 border-t border-gray-200 dark:border-gray-600">
                              <span>Due Today</span>
                              <span>${dueToday.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Pay button */}
                          {dueToday > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex justify-center">
                                <button
                                  onClick={async () => {
                                    try {
                                      const clientEmail = workOrder.client?.email || workOrder.client_user?.email;
                                      const clientName = workOrder.client_name || `${workOrder.client?.first_name || ''} ${workOrder.client?.last_name || ''}`.trim();
                                      if (!clientEmail) { alert('Client email is required for payment processing'); return; }
                                      const response = await apiClient('stripe/create-checkout-session', {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          work_order_id: workOrder.id,
                                          client_email: clientEmail,
                                          client_name: clientName,
                                          amount: dueToday,
                                          success_url: `${window.location.origin}/work-orders/${workOrder.id}?payment=success`,
                                          cancel_url: `${window.location.origin}/work-orders/${workOrder.id}?payment=cancelled`,
                                          metadata: { work_order_number: workOrder.order_number || workOrder.id.slice(0, 8) }
                                        })
                                      });
                                      if (response.url) { window.location.href = response.url; }
                                      else { alert('Failed to create payment session'); }
                                    } catch (error) {
                                      console.error('Payment error:', error);
                                      alert('Failed to process payment: ' + (error.message || 'Unknown error'));
                                    }
                                  }}
                                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium text-lg shadow-lg hover:shadow-xl"
                                >
                                  <div className="flex items-center space-x-3">
                                    <span className="text-xl">💳</span>
                                    <span>Pay ${dueToday.toFixed(2)}</span>
                                  </div>
                                </button>
                              </div>
                              <div className="text-center mt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Secure payment powered by Stripe</span>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Admin Controls */}
                    {user?.roles?.includes('admin') && (
                      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Admin Controls</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Service Billing Status</label>
                            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                              <option value="">Select service...</option>
                              {allServices?.map(service => (
                                <option key={service.id} value={service.id}>
                                  {service.name} - {service.billing_status}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">New Billing Status</label>
                            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                              <option value="not_billable">Not Billable</option>
                              <option value="billable">Billable</option>
                              <option value="paid">Paid</option>
                              <option value="waived">Waived</option>
                            </select>
                          </div>
                          <div>
                            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                              Update Service Status
                            </button>
                          </div>
                          <div>
                            <button className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                              Waive Diagnostic Fee
                            </button>
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Apply Payment</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Amount"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <button 
                              onClick={handleApplyPayment}
                              disabled={isApplyingPayment || !paymentAmount}
                              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                            >
                              {isApplyingPayment ? 'Applying...' : 'Apply Payment'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No billable services or items have been added to this work order yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Status Update Modal */}
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title="Update Work Order Status"
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select new status</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="parts_on_order">Parts on Order</option>
                <option value="reschedule">Reschedule</option>
                <option value="need_to_contact">Need to Contact</option>
                <option value="redo">Redo</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">Notes</label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
                rows={4}
                placeholder="Add notes about this status change"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                className="btn-primary"
                disabled={!newStatus || isMutating}
              >
                {isMutating ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </Modal>
        
        {/* Delete Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Work Order"
        >
          <div className="p-4">
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              Are you sure you want to delete this work order? This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-danger"
                disabled={isMutating}
              >
                {isMutating ? 'Deleting...' : 'Delete Work Order'}
              </button>
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

export async function getServerSideProps(context) {
  const session = await getSession(context.req, context.res);
  
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }
  
  return {
    props: {},
  };
}

export default WorkOrderDetail;