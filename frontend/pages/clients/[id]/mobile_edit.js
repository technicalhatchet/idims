import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaSave, FaTrash, FaTimes } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useClient, useClientMutations } from '../../../hooks/useClients';
import { useAuthRedirect } from '../../../hooks/useAuthRedirect';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';
import { useHudGridDoubleTapRail } from '../../../hooks/useHudGridDoubleTapRail';
import { useUser } from '@auth0/nextjs-auth0/client';

function EditClient() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  
  // Authentication check
  useAuthRedirect();
  
  // HUD grid double tap rail
  const gridTapLayerRef = useHudGridDoubleTapRail();
  
  // Client data fetching
  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  
  // Client mutations
  const { updateClient, deleteClient } = useClientMutations();
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA'
    },
    status: 'active',
    notes: ''
  });
  
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Initialize form with client data when available
  useEffect(() => {
    if (client) {
      setFormData({
        first_name: client.first_name || '',
        last_name: client.last_name || '',
        company_name: client.company_name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: {
          street1: client.address?.street1 || '',
          street2: client.address?.street2 || '',
          city: client.address?.city || '',
          state: client.address?.state || '',
          zip: client.address?.zip || '',
          country: client.address?.country || 'USA'
        },
        status: client.status || 'active',
        notes: client.notes || '',
      });
    }
  }, [client]);
  
  // Form handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle nested address fields
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      await updateClient({
        id,
        ...formData
      });
      setUpdateSuccess(true);
      setTimeout(() => {
        router.push(`/clients/${id}/mobile`);
      }, 3000);
    } catch (error) {
      setSubmitError(error.message || 'An error occurred while updating the client.');
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      await deleteClient(id);
      router.push('/techboard/assets');
    } catch (error) {
      setSubmitError(error.message || 'An error occurred while deleting the client.');
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  const hudGridShiftForTitleplate = 64;

  // Loading state
  if (clientLoading || !id) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Error state
  if (clientError) {
    return (
      <div className="min-h-screen p-4">
        <ErrorAlert message={`Error loading client: ${clientError.message}`} />
        <div className="mt-4">
          <Link href={`/clients/${id}/mobile`} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
            <FaArrowLeft />Back to Client
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>Edit Client | Atomic Repair</title>
      </Head>

      <style jsx>{`
        .edit-tactical-scan {
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
        .edit-hud-titleplate-grid {
          background-image:
            linear-gradient(rgba(34, 211, 238, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.15) 1px, transparent 1px);
          background-size: 8px 8px;
        }
        .edit-hud-orbitron {
          font-family: 'Orbitron', system-ui, -apple-system, sans-serif;
          font-optical-sizing: auto;
          font-weight: 700;
          font-style: normal;
        }
      `}</style>

      <div className="min-h-screen" style={{ background: '#0A0F1E' }}>
        <div className="relative px-4 pt-0 pb-5 max-w-lg mx-auto min-h-screen">
          
          <div className="edit-tactical-scan" />

          <div ref={gridTapLayerRef} className="absolute inset-0 z-[1]" aria-hidden="true" />

          <div 
            className="fixed top-0 left-0 right-0 z-20 edit-hud-titleplate-grid"
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
                href={`/clients/${id}/mobile`}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <FaArrowLeft size={20} />
              </Link>
              <h1 className="edit-hud-orbitron text-cyan-400 text-lg uppercase tracking-wider truncate mx-4">
                Edit Client
              </h1>
              <div className="w-5" />
            </div>
          </div>

          <div 
            className="relative z-10 pb-6"
            style={{
              paddingTop: 'calc(64px + env(safe-area-inset-top) + 1rem)',
              minHeight: '100vh',
            }}
          >
            <div className="px-4 space-y-4">
        
        {updateSuccess && (
          <div 
            className="p-4 rounded-lg flex items-center gap-3"
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
            }}
          >
            <span className="text-green-400 text-xl font-bold">✓</span>
            <div>
              <p className="text-green-400 font-bold">Client updated successfully!</p>
              <p className="text-green-300 text-sm">Redirecting to client profile...</p>
            </div>
          </div>
        )}

        {submitError && (
          <div 
            className="p-4 rounded-lg"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}
          >
            <p className="text-red-400">{submitError}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">Contact Information</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="first_name" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(34, 211, 238, 0.2)',
                    }}
                  />
                </div>
                
                <div>
                  <label htmlFor="last_name" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(34, 211, 238, 0.2)',
                    }}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="company_name" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Company
                </label>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
            </div>
          </div>
          
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
            <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">Address</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="address.street1" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Street Address
                </label>
                <input
                  type="text"
                  id="address.street1"
                  name="address.street1"
                  value={formData.address?.street1 || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="address.street2" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  id="address.street2"
                  name="address.street2"
                  value={formData.address?.street2 || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="address.city" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  id="address.city"
                  name="address.city"
                  value={formData.address?.city || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="address.state" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    id="address.state"
                    name="address.state"
                    value={formData.address?.state || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(34, 211, 238, 0.2)',
                    }}
                  />
                </div>
                
                <div>
                  <label htmlFor="address.zip" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="address.zip"
                    name="address.zip"
                    value={formData.address?.zip || ''}
                    onChange={handleChange}
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
            <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">Additional Information</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="status" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="notes" className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows="4"
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-md text-white text-sm"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(34, 211, 238, 0.2)',
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50 active:opacity-70"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(34, 211, 238, 0.15))',
                border: '1px solid rgba(34, 211, 238, 0.4)',
                color: '#22D3EE',
                boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)',
              }}
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <FaSave />
                  Save Changes
                </>
              )}
            </button>
            
            <Link 
              href={`/clients/${id}/mobile`} 
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all active:opacity-70"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(100, 100, 100, 0.3)',
                color: '#9CA3AF',
              }}
            >
              Cancel
            </Link>
            
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all active:opacity-70"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#EF4444',
              }}
            >
              <FaTrash />
              Delete Client
            </button>
          </div>
        </form>
        
        {showDeleteConfirm && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <div 
              className="rounded-lg max-w-md w-full p-6"
              style={{
                background: 'rgba(13, 21, 37, 0.95)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-red-400 text-lg font-bold uppercase tracking-wide">Confirm Delete</h3>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FaTimes size={20} />
                </button>
              </div>
              <p className="text-gray-300 mb-6 text-sm">
                Are you sure you want to delete this client? This action cannot be undone and will also delete all associated records.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-md text-sm font-medium transition-all active:opacity-70"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(100, 100, 100, 0.3)',
                    color: '#9CA3AF',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-md text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50 active:opacity-70"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.2))',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    color: '#EF4444',
                  }}
                >
                  {isSubmitting ? <LoadingSpinner size="sm" /> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
          </div>
        </div>
      </div>
    </>
  );
}

EditClient.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default withPageAuthRequired(EditClient); 