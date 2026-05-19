import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaArrowLeft, FaEdit, FaPlusCircle, FaPhone, FaEnvelope, FaMapMarkerAlt, FaHistory, FaTools, FaMoneyBillWave, FaFileInvoiceDollar, FaCreditCard, FaPaperPlane, FaHome, FaKey, FaTrash, FaTimes, FaUser } from 'react-icons/fa';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import StatusBadge from '../../../components/ui/StatusBadge';
import Tabs from '../../../components/ui/Tabs';
import { useClient, useClientMutations } from '../../../hooks/useClients';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';
import { apiClient } from '../../../utils/api-client';

const formatPhoneNumber = (phoneNumberString) => {
  if (!phoneNumberString) return '';
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phoneNumberString;
};

const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'rental', label: 'Rental Property' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'flip', label: 'Flip/Investment' },
];

const emptyPropertyForm = {
  address: '',
  unit_number: '',
  property_type: 'residential',
  gate_code: '',
  access_instructions: '',
  tenant_name: '',
  tenant_phone: '',
  tenant_email: '',
};

function ClientDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState('details');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);

  // Properties state
  const [properties, setProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [savingProperty, setSavingProperty] = useState(false);
  const [propertyError, setPropertyError] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);

  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  const { sendRegistrationEmail } = useClientMutations();
  const { data: workOrdersData, isLoading: workOrdersLoading, error: workOrdersError } =
    useWorkOrders({ client_id: id, page: 1, limit: 5 });

  const tabs = [
    { id: 'details', label: 'Details', icon: <FaUser className="mr-2" /> },
    { id: 'properties', label: 'Properties', icon: <FaHome className="mr-2" /> },
    { id: 'work-orders', label: 'Work Orders', icon: <FaTools className="mr-2" /> },
    { id: 'billing', label: 'Billing', icon: <FaMoneyBillWave className="mr-2" /> },
  ];

  // Fetch properties when tab is active or client loads
  useEffect(() => {
    if (!id) return;
    setPropertiesLoading(true);
    apiClient(`properties/client/${id}`)
      .then(data => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]))
      .finally(() => setPropertiesLoading(false));
  }, [id, activeTab]);

  const handleSaveProperty = async () => {
    if (!propertyForm.address.trim()) {
      setPropertyError('Address is required');
      return;
    }
    setSavingProperty(true);
    setPropertyError(null);
    try {
      if (editingProperty) {
        const updated = await apiClient(`properties/${editingProperty.id}`, {
          method: 'PUT',
          body: JSON.stringify(propertyForm),
        });
        setProperties(prev => prev.map(p => p.id === editingProperty.id ? updated : p));
        setEditingProperty(null);
      } else {
        const created = await apiClient('properties', {
          method: 'POST',
          body: JSON.stringify({ client_id: id, ...propertyForm }),
        });
        setProperties(prev => [...prev, created]);
      }
      setPropertyForm(emptyPropertyForm);
      setShowAddProperty(false);
    } catch (err) {
      setPropertyError(err.message || 'Failed to save property');
    } finally {
      setSavingProperty(false);
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (!confirm('Delete this property? This cannot be undone.')) return;
    try {
      await apiClient(`properties/${propertyId}`, { method: 'DELETE' });
      setProperties(prev => prev.filter(p => p.id !== propertyId));
    } catch (err) {
      alert('Failed to delete property: ' + err.message);
    }
  };

  const handleEditProperty = (property) => {
    setEditingProperty(property);
    setPropertyForm({
      address: property.address || '',
      unit_number: property.unit_number || '',
      property_type: property.property_type || 'residential',
      gate_code: property.gate_code || '',
      access_instructions: property.access_instructions || '',
      tenant_name: property.tenant_name || '',
      tenant_phone: property.tenant_phone || '',
      tenant_email: property.tenant_email || '',
    });
    setShowAddProperty(true);
    setPropertyError(null);
  };

  const handleSendRegistrationEmail = async () => {
    if (!client || !client.email) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      await sendRegistrationEmail({
        clientId: id,
        data: { name: `${client.first_name} ${client.last_name}`, company: client.company_name }
      });
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000);
    } catch (error) {
      setEmailError(error.message || 'Failed to send registration email');
    } finally {
      setEmailSending(false);
    }
  };

  if (clientLoading || !id) {
    return <div className="flex justify-center items-center h-96"><LoadingSpinner size="lg" /></div>;
  }

  if (clientError) {
    return (
      <div className="p-6">
        <ErrorAlert message={`Error loading client: ${clientError.message}`} />
        <div className="mt-4">
          <Link href="/clients" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
            <FaArrowLeft className="inline mr-2" />Back to Clients
          </Link>
        </div>
      </div>
    );
  }

  const PropertyForm = () => (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          {editingProperty ? 'Edit Property' : 'Add New Property'}
        </h4>
        <button type="button" onClick={() => { setShowAddProperty(false); setEditingProperty(null); setPropertyForm(emptyPropertyForm); setPropertyError(null); }} className="text-gray-400 hover:text-gray-600">
          <FaTimes />
        </button>
      </div>
      {propertyError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{propertyError}</p>}
      <input type="text" style={{ display: 'none' }} autoComplete="username" readOnly />
      <input type="password" style={{ display: 'none' }} autoComplete="current-password" readOnly />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Address *</label>
          <input type="text" value={propertyForm.address} onChange={e => setPropertyForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, Toledo, OH 43604" autoComplete="off" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Number</label>
          <input type="text" value={propertyForm.unit_number} onChange={e => setPropertyForm(p => ({ ...p, unit_number: e.target.value }))} placeholder="Apt 4B" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Property Type</label>
          <select value={propertyForm.property_type} onChange={e => setPropertyForm(p => ({ ...p, property_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm">
            {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Gate Code</label>
          <input type="text" value={propertyForm.gate_code} onChange={e => setPropertyForm(p => ({ ...p, gate_code: e.target.value }))} placeholder="*1234#" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Access Instructions</label>
          <input type="text" value={propertyForm.access_instructions} onChange={e => setPropertyForm(p => ({ ...p, access_instructions: e.target.value }))} placeholder="Side door, park in back..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
        </div>

        {/* Tenant Info */}
        <div className="md:col-span-2 pt-2 border-t border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tenant / Occupant (optional)</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant Name</label>
          <input type="text" value={propertyForm.tenant_name} onChange={e => setPropertyForm(p => ({ ...p, tenant_name: e.target.value }))} placeholder="John Doe" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant Phone</label>
          <input type="text" value={propertyForm.tenant_phone} onChange={e => setPropertyForm(p => ({ ...p, tenant_phone: e.target.value }))} placeholder="4195551234" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant Email</label>
          <input type="text" value={propertyForm.tenant_email} onChange={e => setPropertyForm(p => ({ ...p, tenant_email: e.target.value }))} placeholder="tenant@email.com" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={handleSaveProperty} disabled={savingProperty} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
          {savingProperty ? 'Saving...' : editingProperty ? 'Save Changes' : 'Add Property'}
        </button>
        <button type="button" onClick={() => { setShowAddProperty(false); setEditingProperty(null); setPropertyForm(emptyPropertyForm); setPropertyError(null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>{client ? `${client.first_name} ${client.last_name}` : 'Client'} | Atomic Repair</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
          <div className="flex items-center mb-4 md:mb-0">
            <Link href="/clients" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-4">
              <FaArrowLeft className="inline mr-2" />Back to Clients
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {client ? `${client.first_name} ${client.last_name}` : 'Client Details'}
            </h1>
            <StatusBadge status={client?.status || 'active'} className="ml-3" />
          </div>
          <div className="flex flex-wrap space-x-3">
            <Link href={`/clients/${id}/edit`} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition mb-2 md:mb-0">
              <FaEdit className="mr-2" />Edit Client
            </Link>
            <Link href={`/work_orders/new?client_id=${id}`} className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
              <FaPlusCircle className="mr-2" />New Work Order
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
                    <a href={`tel:${client.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">{formatPhoneNumber(client.phone)}</a>
                  </p>
                )}
                {client?.email && (
                  <p className="flex items-center">
                    <FaEnvelope className="text-gray-500 dark:text-gray-400 mr-2" />
                    <a href={`mailto:${client.email}`} className="hover:text-blue-600 dark:hover:text-blue-400">{client.email}</a>
                  </p>
                )}
                {properties.length > 0 && (
                  <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <FaHome className="mr-2" />
                    {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} on file
                  </p>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col md:items-end">
              <div className="text-gray-700 dark:text-gray-300">
                <p><span className="font-medium text-gray-900 dark:text-white">Client since:</span>{' '}{client?.created_at ? format(new Date(client.created_at), 'MMM d, yyyy') : 'N/A'}</p>
                <p><span className="font-medium text-gray-900 dark:text-white">Work orders:</span>{' '}{workOrdersData?.totalItems || 0}</p>
                {client?.has_payment_methods && (
                  <p className="flex items-center mt-2 text-green-600 dark:text-green-400">
                    <FaCreditCard className="mr-1" /> Payment method on file
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mt-2">

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
                  <div><p className="font-medium">First Name</p><p>{client?.first_name || 'N/A'}</p></div>
                  <div><p className="font-medium">Last Name</p><p>{client?.last_name || 'N/A'}</p></div>
                  <div><p className="font-medium">Company</p><p>{client?.company_name || 'N/A'}</p></div>
                  <div><p className="font-medium">Email</p><p>{client?.email || 'N/A'}</p></div>
                  <div><p className="font-medium">Phone</p><p>{client?.phone || 'N/A'}</p></div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
                  <div><p className="font-medium">Status</p><StatusBadge status={client?.status || 'active'} /></div>
                  <div><p className="font-medium">Customer ID</p><p>{client?.id || 'N/A'}</p></div>
                  {client?.notes && (
                    <div className="col-span-2"><p className="font-medium">Notes</p><p className="whitespace-pre-line">{client.notes}</p></div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Properties</h3>
                {!showAddProperty && (
                  <button type="button" onClick={() => { setShowAddProperty(true); setEditingProperty(null); setPropertyForm(emptyPropertyForm); }} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                    <FaPlusCircle className="mr-2" />Add Property
                  </button>
                )}
              </div>

              {showAddProperty && <PropertyForm />}

              {propertiesLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : properties.length === 0 && !showAddProperty ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <FaHome className="mx-auto text-gray-400 text-3xl mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No properties on file for this client.</p>
                  <button type="button" onClick={() => setShowAddProperty(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                    Add First Property
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {properties.map(property => (
                    <div key={property.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {property.address}{property.unit_number ? ` — Unit ${property.unit_number}` : ''}
                            </h4>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                              {property.property_type || 'residential'}
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {property.gate_code && (
                              <p className="flex items-center gap-1">
                                <FaKey className="text-gray-400 shrink-0" />
                                Gate: <span className="font-mono text-gray-800 dark:text-gray-200">{property.gate_code}</span>
                              </p>
                            )}
                            {property.access_instructions && (
                              <p className="flex items-start gap-1 sm:col-span-2">
                                <FaMapMarkerAlt className="text-gray-400 shrink-0 mt-0.5" />
                                {property.access_instructions}
                              </p>
                            )}
                          </div>

                          {/* Tenant info */}
                          {(property.tenant_name || property.tenant_phone || property.tenant_email) && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Tenant</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
                                {property.tenant_name && <span className="flex items-center gap-1"><FaUser className="text-gray-400 text-xs" />{property.tenant_name}</span>}
                                {property.tenant_phone && <a href={`tel:${property.tenant_phone}`} className="flex items-center gap-1 hover:text-blue-600"><FaPhone className="text-gray-400 text-xs" />{formatPhoneNumber(property.tenant_phone)}</a>}
                                {property.tenant_email && <a href={`mailto:${property.tenant_email}`} className="flex items-center gap-1 hover:text-blue-600"><FaEnvelope className="text-gray-400 text-xs" />{property.tenant_email}</a>}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Link
                            href={`/work_orders/new?client_id=${id}&address=${encodeURIComponent(property.address + (property.unit_number ? ` Unit ${property.unit_number}` : ''))}&property_id=${property.id}`}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                          >
                            + Work Order
                          </Link>
                          <button type="button" onClick={() => handleEditProperty(property)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                            <FaEdit />
                          </button>
                          <button type="button" onClick={() => handleDeleteProperty(property.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Work Orders Tab */}
          {activeTab === 'work-orders' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Work Orders</h3>
                <Link href={`/work_orders?client_id=${id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center">
                  <FaHistory className="mr-1" /> View All
                </Link>
              </div>
              {workOrdersLoading ? (
                <div className="flex justify-center items-center h-40"><LoadingSpinner /></div>
              ) : workOrdersError ? (
                <ErrorAlert message={`Error loading work orders: ${workOrdersError.message}`} />
              ) : workOrdersData?.items?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {workOrdersData.items.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">#{order.order_number}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {order.scheduled_date ? format(new Date(order.scheduled_date), 'MMM d, yyyy') : 'Not scheduled'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{order.service?.name || 'Multiple Services'}</td>
                          <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={order.status} /></td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/work_orders/${order.id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No work orders found for this client.</p>
                  <Link href={`/work_orders/new?client_id=${id}`} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                    <FaPlusCircle className="mr-2" />Create Work Order
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 md:mb-0">Billing Information</h3>
                <div className="flex space-x-3">
                  <Link href={`/clients/${id}/payment_methods`} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                    <FaCreditCard className="mr-2" />Payment Methods
                  </Link>
                  <Link href={`/invoices/new?client_id=${id}`} className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
                    <FaFileInvoiceDollar className="mr-2" />Create Invoice
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Outstanding Balance</h4>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">${client?.outstanding_balance?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Lifetime Value</h4>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">${client?.lifetime_value?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Payment Status</h4>
                  <StatusBadge status={client?.outstanding_balance > 0 ? 'pending' : 'completed'} />
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Invoices</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">Invoice history will be displayed here.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Registration Email */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Account Registration</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Send an email invitation for this client to create their account in the client portal.</p>
            <button onClick={handleSendRegistrationEmail} disabled={emailSending} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition">
              <FaPaperPlane className="mr-2" />{emailSending ? 'Sending...' : 'Send Registration Email'}
            </button>
            {emailSent && <div className="mt-3 text-green-600 dark:text-green-400"><span className="font-bold">Success!</span> Registration email sent to {client.email}</div>}
            {emailError && <div className="mt-3 text-red-600 dark:text-red-400"><span className="font-bold">Error!</span> {emailError}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

ClientDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(ClientDetail);
