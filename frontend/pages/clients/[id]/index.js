import { useState } from 'react';
import { useRouter } from 'next/router';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaArrowLeft, FaEdit, FaPlusCircle, FaPhone, FaEnvelope, FaMapMarkerAlt, FaHistory, FaTools, FaMoneyBillWave, FaFileInvoiceDollar, FaCreditCard, FaPaperPlane } from 'react-icons/fa';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import StatusBadge from '../../../components/ui/StatusBadge';
import Tabs from '../../../components/ui/Tabs';
import { useClient, useClientMutations } from '../../../hooks/useClients';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';

// Function to format phone number as (###) ###-####
const formatPhoneNumber = (phoneNumberString) => {
  if (!phoneNumberString) return '';
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phoneNumberString;
};

function ClientDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState('details');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);
  
  // Fetch client data
  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  
  // Client mutations
  const { sendRegistrationEmail } = useClientMutations();
  
  // Fetch work orders for this client
  const { data: workOrdersData, isLoading: workOrdersLoading, error: workOrdersError } = 
    useWorkOrders({ 
      client_id: id,
      page: 1,
      limit: 5 
    });
  
  const tabs = [
    { id: 'details', label: 'Details', icon: <FaMapMarkerAlt className="mr-2" /> },
    { id: 'work-orders', label: 'Work Orders', icon: <FaTools className="mr-2" /> },
    { id: 'billing', label: 'Billing', icon: <FaMoneyBillWave className="mr-2" /> }
  ];
  
  // Handle sending registration email
  const handleSendRegistrationEmail = async () => {
    if (!client || !client.email) return;
    
    setEmailSending(true);
    setEmailError(null);
    try {
      await sendRegistrationEmail({
        clientId: id,
        data: {
          name: `${client.first_name} ${client.last_name}`,
          company: client.company_name
        }
      });
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000); // Clear success message after 5 seconds
    } catch (error) {
      setEmailError(error.message || 'Failed to send registration email');
    } finally {
      setEmailSending(false);
    }
  };
  
  // If loading or no ID yet
  if (clientLoading || !id) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // If error fetching client
  if (clientError) {
    return (
      <div className="p-6">
        <ErrorAlert message={`Error loading client: ${clientError.message}`} />
        <div className="mt-4">
          <Link href="/clients" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
            <FaArrowLeft className="inline mr-2" />
            Back to Clients
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>{client ? `${client.first_name} ${client.last_name}` : 'Client'} | Service Business Management</title>
      </Head>
      
      <div className="px-4 py-6">
        {/* Header with back button and actions */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
          <div className="flex items-center mb-4 md:mb-0">
            <Link href="/clients" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-4">
              <FaArrowLeft className="inline mr-2" />
              Back to Clients
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {client ? `${client.first_name} ${client.last_name}` : 'Client Details'}
            </h1>
            <StatusBadge status={client?.status || 'active'} className="ml-3" />
          </div>
          
          <div className="flex flex-wrap space-x-3">
            <Link 
              href={`/clients/${id}/edit`}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition mb-2 md:mb-0"
            >
              <FaEdit className="mr-2" />
              Edit Client
            </Link>
            
            <Link 
              href={`/work_orders/new?client_id=${id}`}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 transition"
            >
              <FaPlusCircle className="mr-2" />
              New Work Order
            </Link>
          </div>
        </div>
        
        {/* Client overview card */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row">
            <div className="flex-1 mb-4 md:mb-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {client?.company_name 
                  ? `${client.first_name} ${client.last_name} (${client.company_name})` 
                  : `${client.first_name} ${client.last_name}`}
              </h2>
              
              <div className="space-y-2 text-gray-700 dark:text-gray-300">
                {client?.phone && (
                  <p className="flex items-center">
                    <FaPhone className="text-gray-500 dark:text-gray-400 mr-2" />
                    <a href={`tel:${client.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                      {formatPhoneNumber(client.phone)}
                    </a>
                  </p>
                )}
                
                {client?.email && (
                  <p className="flex items-center">
                    <FaEnvelope className="text-gray-500 dark:text-gray-400 mr-2" />
                    <a href={`mailto:${client.email}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                      {client.email}
                    </a>
                  </p>
                )}
                
                {client?.address && (
                  <p className="flex items-center">
                    <FaMapMarkerAlt className="text-gray-500 dark:text-gray-400 mr-2" />
                    {client.address.street1}
                    {client.address.street2 && `, ${client.address.street2}`}
                    {client.address.city && client.address.state && `, ${client.address.city}, ${client.address.state}`}
                    {client.address.zip && ` ${client.address.zip}`}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex-shrink-0 flex flex-col md:items-end">
              <div className="text-gray-700 dark:text-gray-300">
                <p>
                  <span className="font-medium text-gray-900 dark:text-white">Client since:</span>{' '}
                  {client?.created_at 
                    ? format(new Date(client.created_at), 'MMM d, yyyy')
                    : 'N/A'}
                </p>
                
                <p>
                  <span className="font-medium text-gray-900 dark:text-white">Work orders:</span>{' '}
                  {workOrdersData?.totalItems || 0}
                </p>
                
                {client?.has_payment_methods && (
                  <p className="flex items-center mt-2 text-green-600 dark:text-green-400">
                    <FaCreditCard className="mr-1" /> Payment method on file
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs for different sections */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        
        {/* Tab content */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mt-2">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
                  <div>
                    <p className="font-medium">First Name</p>
                    <p>{client?.first_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Last Name</p>
                    <p>{client?.last_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Company</p>
                    <p>{client?.company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <p>{client?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Phone</p>
                    <p>{client?.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
                  <div>
                    <p className="font-medium">Street</p>
                    <p>{client?.address?.street1 || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Address Line 2</p>
                    <p>{client?.address?.street2 || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">City</p>
                    <p>{client?.address?.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">State</p>
                    <p>{client?.address?.state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">ZIP Code</p>
                    <p>{client?.address?.zip || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Country</p>
                    <p>{client?.address?.country || 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
                  <div>
                    <p className="font-medium">Status</p>
                    <StatusBadge status={client?.status || 'active'} />
                  </div>
                  <div>
                    <p className="font-medium">Customer ID</p>
                    <p>{client?.id || 'N/A'}</p>
                  </div>
                  {client?.notes && (
                    <div className="col-span-2">
                      <p className="font-medium">Notes</p>
                      <p className="whitespace-pre-line">{client.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'work-orders' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Work Orders</h3>
                <Link
                  href={`/work_orders?client_id=${id}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                >
                  <FaHistory className="mr-1" /> View All
                </Link>
              </div>
              
              {workOrdersLoading ? (
                <div className="flex justify-center items-center h-40">
                  <LoadingSpinner />
                </div>
              ) : workOrdersError ? (
                <ErrorAlert message={`Error loading work orders: ${workOrdersError.message}`} />
              ) : workOrdersData?.items?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Order #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {workOrdersData.items.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            #{order.order_number}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {order.scheduled_date 
                              ? format(new Date(order.scheduled_date), 'MMM d, yyyy')
                              : 'Not scheduled'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {order.service?.name || 'Multiple Services'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            ${order.total_amount?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <Link 
                              href={`/work_orders/${order.id}`}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No work orders found for this client.</p>
                  <Link
                    href={`/work_orders/new?client_id=${id}`}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition"
                  >
                    <FaPlusCircle className="mr-2" />
                    Create Work Order
                  </Link>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'billing' && (
            <div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 md:mb-0">Billing Information</h3>
                <div className="flex space-x-3">
                  <Link
                    href={`/clients/${id}/payment_methods`}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition"
                  >
                    <FaCreditCard className="mr-2" />
                    Payment Methods
                  </Link>
                  <Link
                    href={`/invoices/new?client_id=${id}`}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 transition"
                  >
                    <FaFileInvoiceDollar className="mr-2" />
                    Create Invoice
                  </Link>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Outstanding Balance</h4>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${client?.outstanding_balance?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Lifetime Value</h4>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${client?.lifetime_value?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Payment Status</h4>
                  <StatusBadge 
                    status={
                      client?.outstanding_balance > 0 
                        ? 'pending'
                        : 'completed'
                    } 
                  />
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Invoices</h4>
                
                {/* This would use another hook like useClientInvoices */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    Invoice history will be displayed here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Registration Email Section at the bottom */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Account Registration</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Send an email invitation for this client to create their account in the client portal.
          </p>
          
          <button
            onClick={handleSendRegistrationEmail}
            disabled={emailSending}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 transition"
          >
            <FaPaperPlane className="mr-2" />
            {emailSending ? 'Sending...' : 'Send Registration Email'}
          </button>
          
          {emailSent && (
            <div className="mt-3 text-green-600 dark:text-green-400">
              <span className="font-bold">Success!</span> Registration email sent to {client.email}
            </div>
          )}
          
          {emailError && (
            <div className="mt-3 text-red-600 dark:text-red-400">
              <span className="font-bold">Error!</span> {emailError}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Use the dashboard layout
ClientDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(ClientDetail); 