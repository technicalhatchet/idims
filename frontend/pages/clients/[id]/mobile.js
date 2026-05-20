import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaArrowLeft, FaEdit, FaPlusCircle, FaPhone, FaEnvelope, FaMapMarkerAlt, FaHistory, FaTools, FaMoneyBillWave, FaFileInvoiceDollar, FaCreditCard, FaPaperPlane, FaHome, FaKey, FaTrash, FaTimes, FaUser, FaBuilding, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import StatusBadge from '../../../components/ui/StatusBadge';
import { useClient, useClientMutations } from '../../../hooks/useClients';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';
import { apiClient } from '../../../utils/api-client';
import { useHudGridDoubleTapRail } from '../../../hooks/useHudGridDoubleTapRail';
import { useUser } from '@auth0/nextjs-auth0/client';

const formatPhoneNumber = (phoneNumberString) => {
  if (!phoneNumberString) return '';
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) return '(' + match[1] + ') ' + match[2] + '-' + match[3];
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

function PropertyForm({ propertyForm, setPropertyForm, propertyError, savingProperty, editingProperty, onSave, onCancel }) {
  return (
    <div 
      className="rounded-lg p-4 mb-4"
      style={{
        background: 'rgba(13, 21, 37, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(34, 211, 238, 0.3)',
        boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
      }}
    >
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">
          {editingProperty ? 'Edit Property' : 'Add New Property'}
        </h4>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-cyan-400 transition-colors">
          <FaTimes />
        </button>
      </div>
      {propertyError && <p className="text-sm text-red-400 mb-3 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{propertyError}</p>}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Address *</label>
          <input 
            type="text" 
            value={propertyForm.address} 
            onChange={e => setPropertyForm(p => ({ ...p, address: e.target.value }))} 
            placeholder="123 Main St, Toledo, OH 43604" 
            autoComplete="off" 
            className="w-full px-3 py-2.5 rounded-md text-white text-sm"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(34, 211, 238, 0.2)',
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Unit Number</label>
            <input 
              type="text" 
              value={propertyForm.unit_number} 
              onChange={e => setPropertyForm(p => ({ ...p, unit_number: e.target.value }))} 
              placeholder="Apt 4B" 
              autoComplete="off" 
              className="w-full px-3 py-2.5 rounded-md text-white text-sm"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(34, 211, 238, 0.2)',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Property Type</label>
            <select 
              value={propertyForm.property_type} 
              onChange={e => setPropertyForm(p => ({ ...p, property_type: e.target.value }))} 
              className="w-full px-3 py-2.5 rounded-md text-white text-sm"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(34, 211, 238, 0.2)',
              }}
            >
              {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Gate Code</label>
            <input 
              type="text" 
              value={propertyForm.gate_code} 
              onChange={e => setPropertyForm(p => ({ ...p, gate_code: e.target.value }))} 
              placeholder="*1234#" 
              autoComplete="off" 
              className="w-full px-3 py-2.5 rounded-md text-white text-sm font-mono"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(34, 211, 238, 0.2)',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Access Instructions</label>
            <input 
              type="text" 
              value={propertyForm.access_instructions} 
              onChange={e => setPropertyForm(p => ({ ...p, access_instructions: e.target.value }))} 
              placeholder="Side door, back..." 
              autoComplete="off" 
              className="w-full px-3 py-2.5 rounded-md text-white text-sm"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(34, 211, 238, 0.2)',
              }}
            />
          </div>
        </div>
        <div className="pt-2 border-t border-cyan-500/20 mt-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tenant / Occupant (optional)</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Tenant Name</label>
              <input 
                type="text" 
                value={propertyForm.tenant_name} 
                onChange={e => setPropertyForm(p => ({ ...p, tenant_name: e.target.value }))} 
                placeholder="John Doe" 
                autoComplete="off" 
                className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(34, 211, 238, 0.2)',
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Tenant Phone</label>
                <input 
                  type="text" 
                  value={propertyForm.tenant_phone} 
                  onChange={e => setPropertyForm(p => ({ ...p, tenant_phone: e.target.value }))} 
                  placeholder="4195551234" 
                  autoComplete="off" 
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Tenant Email</label>
                <input 
                  type="text" 
                  value={propertyForm.tenant_email} 
                  onChange={e => setPropertyForm(p => ({ ...p, tenant_email: e.target.value }))} 
                  placeholder="tenant@email.com" 
                  autoComplete="off" 
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button 
          type="button" 
          onClick={onSave} 
          disabled={savingProperty} 
          className="flex-1 py-2.5 rounded-md text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
            border: '1px solid rgba(34, 211, 238, 0.4)',
            color: '#22D3EE',
            boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)',
          }}
        >
          {savingProperty ? 'Saving...' : editingProperty ? 'Save Changes' : 'Add Property'}
        </button>
        <button 
          type="button" 
          onClick={onCancel} 
          className="px-4 py-2.5 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-colors"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(100, 100, 100, 0.3)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ClientDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);
  const [workOrdersExpanded, setWorkOrdersExpanded] = useState(false);
  const [billingExpanded, setBillingExpanded] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [savingProperty, setSavingProperty] = useState(false);
  const [propertyError, setPropertyError] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  
  useHudGridDoubleTapRail();

  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  const { sendRegistrationEmail } = useClientMutations();
  const { data: workOrdersData, isLoading: workOrdersLoading, error: workOrdersError } =
    useWorkOrders({ client_id: id, page: 1, limit: 100 });

  useEffect(() => {
    if (!id) return;
    setPropertiesLoading(true);
    apiClient(`properties/client/${id}`)
      .then(data => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]))
      .finally(() => setPropertiesLoading(false));
  }, [id]);

  const handleCancelProperty = () => {
    setShowAddProperty(false);
    setEditingProperty(null);
    setPropertyForm(emptyPropertyForm);
    setPropertyError(null);
  };

  const handleSaveProperty = async () => {
    if (!propertyForm.address.trim()) { setPropertyError('Address is required'); return; }
    setSavingProperty(true);
    setPropertyError(null);
    try {
      if (editingProperty) {
        const updated = await apiClient(`properties/${editingProperty.id}`, { method: 'PUT', body: JSON.stringify(propertyForm) });
        setProperties(prev => prev.map(p => p.id === editingProperty.id ? updated : p));
        setEditingProperty(null);
      } else {
        const created = await apiClient('properties', { method: 'POST', body: JSON.stringify({ client_id: id, ...propertyForm }) });
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
      await sendRegistrationEmail({ clientId: id, data: { name: `${client.first_name} ${client.last_name}`, company: client.company_name } });
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000);
    } catch (error) {
      setEmailError(error.message || 'Failed to send registration email');
    } finally {
      setEmailSending(false);
    }
  };

  const hudGridShiftForTitleplate = 64;

  if (clientLoading || !id) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (clientError) {
    return (
      <div className="min-h-screen p-4">
        <ErrorAlert message={`Error loading client: ${clientError.message}`} />
        <div className="mt-4">
          <Link href="/techboard/assets" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
            <FaArrowLeft />Back to Assets
          </Link>
        </div>
      </div>
    );
  }

  const displayName = client?.company_name || `${client?.first_name || ''} ${client?.last_name || ''}`.trim();
  const isCompany = Boolean(client?.company_name);
  const contactName = isCompany ? `${client?.first_name || ''} ${client?.last_name || ''}`.trim() : null;

  return (
    <>
      <Head>
        <title>{displayName || 'Client'} | Atomic Repair</title>
      </Head>

      <style jsx>{`
        .client-tactical-scan {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image:
            linear-gradient(rgba(34, 211, 238, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.03) 1px, transparent 1px);
          background-size: 24px 24px;
          background-position: 0 ${hudGridShiftForTitleplate}px, 0 ${hudGridShiftForTitleplate}px;
          pointer-events: none;
          z-index: 0;
        }
        .client-hud-titleplate-grid {
          background-image:
            linear-gradient(rgba(34, 211, 238, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.15) 1px, transparent 1px);
          background-size: 8px 8px;
        }
        .client-hud-orbitron {
          font-family: 'Orbitron', system-ui, -apple-system, sans-serif;
          font-optical-sizing: auto;
          font-weight: 700;
          font-style: normal;
        }
        .client-neon-edge {
          box-shadow: 0 0 20px rgba(34, 211, 238, 0.4), inset 0 0 20px rgba(34, 211, 238, 0.1);
        }
      `}</style>

      <div className="client-tactical-scan" />

      <div 
        className="fixed top-0 left-0 right-0 z-20 client-hud-titleplate-grid"
        style={{
          height: '64px',
          background: 'linear-gradient(180deg, rgba(13, 21, 37, 0.98) 0%, rgba(13, 21, 37, 0.95) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '2px solid rgba(34, 211, 238, 0.5)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="h-full flex items-center justify-between px-4">
          <Link 
            href="/techboard/assets"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <FaArrowLeft size={20} />
          </Link>
          <h1 className="client-hud-orbitron text-cyan-400 text-lg uppercase tracking-wider truncate mx-4">
            Client Profile
          </h1>
          <Link
            href={`/clients/${id}/mobile_edit`}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <FaEdit size={18} />
          </Link>
        </div>
      </div>

      <div 
        className="pb-6"
        style={{
          paddingTop: 'calc(64px + env(safe-area-inset-top) + 1rem)',
          minHeight: '100vh',
        }}
      >
        <div className="px-4 space-y-4">
          <div 
            className="rounded-lg p-4"
            style={{
              background: 'rgba(13, 21, 37, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div 
                className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.05))',
                  border: '1px solid rgba(34, 211, 238, 0.3)',
                }}
              >
                {isCompany ? (
                  <FaBuilding className="text-cyan-400" size={24} />
                ) : (
                  <FaUser className="text-cyan-400" size={24} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white truncate">{displayName}</h2>
                  <span 
                    className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide flex-shrink-0"
                    style={{
                      background: client?.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                      color: client?.status === 'active' ? '#22C55E' : '#9CA3AF',
                      border: `1px solid ${client?.status === 'active' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(156, 163, 175, 0.4)'}`,
                    }}
                  >
                    {client?.status || 'active'}
                  </span>
                </div>
                {contactName && (
                  <p className="text-sm text-gray-400 mb-2">{contactName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {client?.phone && (
                <a 
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-3 p-2.5 rounded-md transition-all active:opacity-70"
                  style={{
                    background: 'rgba(34, 211, 238, 0.05)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                >
                  <FaPhone className="text-cyan-400 flex-shrink-0" size={16} />
                  <span className="text-white">{formatPhoneNumber(client.phone)}</span>
                </a>
              )}
              {client?.email && (
                <a 
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-3 p-2.5 rounded-md transition-all active:opacity-70"
                  style={{
                    background: 'rgba(34, 211, 238, 0.05)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                >
                  <FaEnvelope className="text-cyan-400 flex-shrink-0" size={16} />
                  <span className="text-white text-sm truncate">{client.email}</span>
                </a>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-cyan-500/20">
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Properties</p>
                <p className="text-lg font-bold text-cyan-400">{properties.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Work Orders</p>
                <p className="text-lg font-bold text-cyan-400">{workOrdersData?.totalItems || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Since</p>
                <p className="text-xs font-medium text-white">
                  {client?.created_at ? format(new Date(client.created_at), 'MMM yyyy') : 'N/A'}
                </p>
              </div>
            </div>

            <Link
              href={`/work_orders/new?client_id=${id}`}
              className="flex items-center justify-center gap-2 w-full py-3 mt-4 rounded-lg text-sm font-bold uppercase tracking-wide transition-all active:opacity-70"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(34, 211, 238, 0.15))',
                border: '1px solid rgba(34, 211, 238, 0.4)',
                color: '#22D3EE',
                boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)',
              }}
            >
              <FaPlusCircle />
              New Work Order
            </Link>
          </div>

          <div 
            className="rounded-lg overflow-hidden"
            style={{
              background: 'rgba(13, 21, 37, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
            }}
          >
            <button
              type="button"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="w-full flex items-center justify-between p-4 transition-colors active:bg-cyan-500/10"
            >
              <div className="flex items-center gap-3">
                <FaUser className="text-cyan-400" size={18} />
                <span className="text-white font-bold uppercase tracking-wide">Details</span>
              </div>
              {detailsExpanded ? (
                <FaChevronUp className="text-cyan-400" size={16} />
              ) : (
                <FaChevronDown className="text-cyan-400" size={16} />
              )}
            </button>
            {detailsExpanded && (
              <div className="px-4 pb-4 space-y-4">
                <div className="pt-2 border-t border-cyan-500/20">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Contact Information</p>
                  <div className="space-y-2.5">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">First Name</p>
                      <p className="text-white">{client?.first_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Last Name</p>
                      <p className="text-white">{client?.last_name || 'N/A'}</p>
                    </div>
                    {client?.company_name && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Company</p>
                        <p className="text-white">{client.company_name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                      <p className="text-cyan-400 text-sm">{client?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                      <p className="text-cyan-400">{client?.phone ? formatPhoneNumber(client.phone) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
                {client?.notes && (
                  <div className="pt-3 border-t border-cyan-500/20">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Notes</p>
                    <p className="text-sm text-gray-300 whitespace-pre-line">{client.notes}</p>
                  </div>
                )}
                <div className="pt-3 border-t border-cyan-500/20">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Additional Info</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Customer ID</p>
                      <p className="text-xs text-gray-400 font-mono">{client?.id || 'N/A'}</p>
                    </div>
                    {client?.has_payment_methods && (
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <FaCreditCard size={14} />
                        Payment method on file
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div 
            className="rounded-lg overflow-hidden"
            style={{
              background: 'rgba(13, 21, 37, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
            }}
          >
            <button
              type="button"
              onClick={() => setPropertiesExpanded(!propertiesExpanded)}
              className="w-full flex items-center justify-between p-4 transition-colors active:bg-cyan-500/10"
            >
              <div className="flex items-center gap-3">
                <FaHome className="text-cyan-400" size={18} />
                <span className="text-white font-bold uppercase tracking-wide">Properties</span>
                {properties.length > 0 && (
                  <span 
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: 'rgba(34, 211, 238, 0.2)',
                      color: '#22D3EE',
                    }}
                  >
                    {properties.length}
                  </span>
                )}
              </div>
              {propertiesExpanded ? (
                <FaChevronUp className="text-cyan-400" size={16} />
              ) : (
                <FaChevronDown className="text-cyan-400" size={16} />
              )}
            </button>
            {propertiesExpanded && (
              <div className="px-4 pb-4">
                {!showAddProperty && (
                  <button 
                    type="button" 
                    onClick={() => { 
                      setShowAddProperty(true); 
                      setEditingProperty(null); 
                      setPropertyForm(emptyPropertyForm); 
                    }} 
                    className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 rounded-md text-sm font-bold uppercase tracking-wide transition-all active:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                      border: '1px solid rgba(34, 211, 238, 0.4)',
                      color: '#22D3EE',
                    }}
                  >
                    <FaPlusCircle />
                    Add Property
                  </button>
                )}

                {showAddProperty && (
                  <PropertyForm
                    propertyForm={propertyForm}
                    setPropertyForm={setPropertyForm}
                    propertyError={propertyError}
                    savingProperty={savingProperty}
                    editingProperty={editingProperty}
                    onSave={handleSaveProperty}
                    onCancel={handleCancelProperty}
                  />
                )}

                {propertiesLoading ? (
                  <div className="flex justify-center py-8"><LoadingSpinner /></div>
                ) : properties.length === 0 && !showAddProperty ? (
                  <div className="text-center py-8">
                    <FaHome className="mx-auto text-gray-600 text-3xl mb-3" />
                    <p className="text-gray-400 mb-4 text-sm">No properties on file for this client.</p>
                    <button 
                      type="button" 
                      onClick={() => setShowAddProperty(true)} 
                      className="px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wide"
                      style={{
                        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                        border: '1px solid rgba(34, 211, 238, 0.4)',
                        color: '#22D3EE',
                      }}
                    >
                      Add First Property
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {properties.map(property => (
                      <div 
                        key={property.id} 
                        className="rounded-lg p-3"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(34, 211, 238, 0.2)',
                        }}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <FaMapMarkerAlt className="text-cyan-400 flex-shrink-0 mt-1" size={14} />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm">
                              {property.address}
                              {property.unit_number && ` — Unit ${property.unit_number}`}
                            </p>
                            <span 
                              className="inline-block px-2 py-0.5 mt-1 text-xs rounded capitalize"
                              style={{
                                background: 'rgba(34, 211, 238, 0.15)',
                                color: '#22D3EE',
                                border: '1px solid rgba(34, 211, 238, 0.3)',
                              }}
                            >
                              {property.property_type || 'residential'}
                            </span>
                          </div>
                        </div>

                        {(property.gate_code || property.access_instructions) && (
                          <div className="space-y-1.5 mb-2 text-xs">
                            {property.gate_code && (
                              <div className="flex items-center gap-2">
                                <FaKey className="text-gray-500 flex-shrink-0" size={12} />
                                <span className="text-gray-400">Gate:</span>
                                <span className="text-cyan-400 font-mono">{property.gate_code}</span>
                              </div>
                            )}
                            {property.access_instructions && (
                              <p className="text-gray-400 text-xs">{property.access_instructions}</p>
                            )}
                          </div>
                        )}

                        {(property.tenant_name || property.tenant_phone || property.tenant_email) && (
                          <div className="pt-2 mt-2 border-t border-cyan-500/20">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Tenant</p>
                            <div className="space-y-1">
                              {property.tenant_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <FaUser className="text-gray-500" size={12} />
                                  <span className="text-white">{property.tenant_name}</span>
                                </div>
                              )}
                              {property.tenant_phone && (
                                <a 
                                  href={`tel:${property.tenant_phone}`} 
                                  className="flex items-center gap-2 text-sm text-cyan-400 active:opacity-70"
                                >
                                  <FaPhone className="text-gray-500" size={12} />
                                  {formatPhoneNumber(property.tenant_phone)}
                                </a>
                              )}
                              {property.tenant_email && (
                                <a 
                                  href={`mailto:${property.tenant_email}`} 
                                  className="flex items-center gap-2 text-xs text-cyan-400 active:opacity-70 truncate"
                                >
                                  <FaEnvelope className="text-gray-500 flex-shrink-0" size={12} />
                                  <span className="truncate">{property.tenant_email}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-cyan-500/20">
                          <Link 
                            href={`/work_orders/new?client_id=${id}&address=${encodeURIComponent(property.address + (property.unit_number ? ` Unit ${property.unit_number}` : ''))}&property_id=${property.id}`} 
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all active:opacity-70"
                            style={{
                              background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                              border: '1px solid rgba(34, 211, 238, 0.4)',
                              color: '#22D3EE',
                            }}
                          >
                            <FaTools size={12} />
                            New WO
                          </Link>
                          <button 
                            type="button" 
                            onClick={() => handleEditProperty(property)} 
                            className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <FaEdit size={16} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteProperty(property.id)} 
                            className="p-2 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <FaTrash size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div 
            className="rounded-lg overflow-hidden"
            style={{
              background: 'rgba(13, 21, 37, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
            }}
          >
            <button
              type="button"
              onClick={() => setWorkOrdersExpanded(!workOrdersExpanded)}
              className="w-full flex items-center justify-between p-4 transition-colors active:bg-cyan-500/10"
            >
              <div className="flex items-center gap-3">
                <FaTools className="text-cyan-400" size={18} />
                <span className="text-white font-bold uppercase tracking-wide">Work Orders</span>
                {workOrdersData?.totalItems > 0 && (
                  <span 
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: 'rgba(34, 211, 238, 0.2)',
                      color: '#22D3EE',
                    }}
                  >
                    {workOrdersData.totalItems}
                  </span>
                )}
              </div>
              {workOrdersExpanded ? (
                <FaChevronUp className="text-cyan-400" size={16} />
              ) : (
                <FaChevronDown className="text-cyan-400" size={16} />
              )}
            </button>
            {workOrdersExpanded && (
              <div className="px-4 pb-4">
                {workOrdersLoading ? (
                  <div className="flex justify-center py-8"><LoadingSpinner /></div>
                ) : workOrdersError ? (
                  <ErrorAlert message={`Error loading work orders: ${workOrdersError.message}`} />
                ) : workOrdersData?.items?.length > 0 ? (
                  <div className="space-y-2">
                    {workOrdersData.items.map((order) => (
                      <Link
                        key={order.id}
                        href={`/work_orders/${order.id}/mobile`}
                        className="block rounded-lg p-3 transition-all active:opacity-70"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(34, 211, 238, 0.2)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-cyan-400 font-bold text-sm">#{order.order_number}</p>
                            <p className="text-white text-xs mt-0.5">
                              {order.service?.name || 'Multiple Services'}
                            </p>
                          </div>
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide flex-shrink-0"
                            style={{
                              background: order.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : 
                                         order.status === 'in_progress' || order.status === 'en_route' ? 'rgba(251, 191, 36, 0.2)' :
                                         order.status === 'scheduled' ? 'rgba(59, 130, 246, 0.2)' : 
                                         'rgba(156, 163, 175, 0.2)',
                              color: order.status === 'completed' ? '#22C55E' : 
                                    order.status === 'in_progress' || order.status === 'en_route' ? '#FBBF24' :
                                    order.status === 'scheduled' ? '#3B82F6' : 
                                    '#9CA3AF',
                              border: `1px solid ${
                                order.status === 'completed' ? 'rgba(34, 197, 94, 0.4)' : 
                                order.status === 'in_progress' || order.status === 'en_route' ? 'rgba(251, 191, 36, 0.4)' :
                                order.status === 'scheduled' ? 'rgba(59, 130, 246, 0.4)' : 
                                'rgba(156, 163, 175, 0.4)'
                              }`,
                            }}
                          >
                            {order.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {order.scheduled_date ? format(new Date(order.scheduled_date), 'MMM d, yyyy') : 'Not scheduled'}
                        </div>
                      </Link>
                    ))}
                    {workOrdersData.totalItems > workOrdersData.items.length && (
                      <Link
                        href={`/work_orders?client_id=${id}`}
                        className="block text-center py-2.5 mt-2 rounded-md text-sm font-medium text-cyan-400 transition-all active:opacity-70"
                        style={{
                          background: 'rgba(34, 211, 238, 0.1)',
                          border: '1px solid rgba(34, 211, 238, 0.3)',
                        }}
                      >
                        View All ({workOrdersData.totalItems})
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FaTools className="mx-auto text-gray-600 text-3xl mb-3" />
                    <p className="text-gray-400 mb-4 text-sm">No work orders found for this client.</p>
                    <Link 
                      href={`/work_orders/new?client_id=${id}`} 
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wide"
                      style={{
                        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                        border: '1px solid rgba(34, 211, 238, 0.4)',
                        color: '#22D3EE',
                      }}
                    >
                      <FaPlusCircle />
                      Create Work Order
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div 
            className="rounded-lg overflow-hidden"
            style={{
              background: 'rgba(13, 21, 37, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
            }}
          >
            <button
              type="button"
              onClick={() => setBillingExpanded(!billingExpanded)}
              className="w-full flex items-center justify-between p-4 transition-colors active:bg-cyan-500/10"
            >
              <div className="flex items-center gap-3">
                <FaMoneyBillWave className="text-cyan-400" size={18} />
                <span className="text-white font-bold uppercase tracking-wide">Billing</span>
              </div>
              {billingExpanded ? (
                <FaChevronUp className="text-cyan-400" size={16} />
              ) : (
                <FaChevronDown className="text-cyan-400" size={16} />
              )}
            </button>
            {billingExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    href={`/clients/${id}/payment_methods`} 
                    className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all active:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                      border: '1px solid rgba(34, 211, 238, 0.4)',
                      color: '#22D3EE',
                    }}
                  >
                    <FaCreditCard size={14} />
                    Payment Methods
                  </Link>
                  <Link 
                    href={`/invoices/new?client_id=${id}`} 
                    className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all active:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.1))',
                      border: '1px solid rgba(34, 211, 238, 0.4)',
                      color: '#22D3EE',
                    }}
                  >
                    <FaFileInvoiceDollar size={14} />
                    Create Invoice
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div 
                    className="rounded-lg p-3"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Outstanding</p>
                    <p className="text-xl font-bold text-red-400">${client?.outstanding_balance?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div 
                    className="rounded-lg p-3"
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Lifetime</p>
                    <p className="text-xl font-bold text-green-400">${client?.lifetime_value?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                <div 
                  className="rounded-lg p-4 text-center mt-3"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                >
                  <p className="text-sm text-gray-400">Invoice history will be displayed here.</p>
                </div>
              </div>
            )}
          </div>

          <div 
            className="rounded-lg p-4"
            style={{
              background: 'rgba(13, 21, 37, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              boxShadow: '0 0 20px rgba(147, 51, 234, 0.15)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <FaPaperPlane className="text-purple-400" size={20} />
              <h3 className="text-white font-bold uppercase tracking-wide">Client Portal</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Send an email invitation for this client to create their account in the client portal.
            </p>
            <button 
              onClick={handleSendRegistrationEmail} 
              disabled={emailSending} 
              className="w-full flex items-center justify-center gap-2 py-3 rounded-md text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50 active:opacity-70"
              style={{
                background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.3), rgba(147, 51, 234, 0.2))',
                border: '1px solid rgba(147, 51, 234, 0.5)',
                color: '#C084FC',
              }}
            >
              <FaPaperPlane />
              {emailSending ? 'Sending...' : 'Send Registration Email'}
            </button>
            {emailSent && (
              <div 
                className="mt-3 p-3 rounded-md text-sm"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#22C55E',
                }}
              >
                <span className="font-bold">Success!</span> Registration email sent to {client.email}
              </div>
            )}
            {emailError && (
              <div 
                className="mt-3 p-3 rounded-md text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                }}
              >
                <span className="font-bold">Error!</span> {emailError}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

ClientDetail.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default withPageAuthRequired(ClientDetail);