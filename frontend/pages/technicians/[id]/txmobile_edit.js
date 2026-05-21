import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaSave, FaTrash, FaTimes } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import { useTechDashboardRail } from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useTechnician, useTechnicianMutations } from '../../../hooks/useTechnicians';
import { useUser } from '@auth0/nextjs-auth0/client';

const hudGridShiftForTitleplate = 0;

function TechnicianMobileEdit() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();

  const { data: technician, isLoading: technicianLoading, error: technicianError } = useTechnician(id);

  const tacticalColumnRef = useRef(null);
  const { openRail } = useTechDashboardRail() || {};

  // Attach double-tap listener
  useEffect(() => {
    if (technicianLoading || technicianError || !tacticalColumnRef.current || !openRail) return;

    const layer = tacticalColumnRef.current;
    const lastTap = { t: 0, x: 0, y: 0 };

    const tryOpenRail = (x, y, event) => {
      const now = Date.now();
      const dt = now - lastTap.t;
      const dist = Math.hypot(x - lastTap.x, y - lastTap.y);
      if (lastTap.t && dt < 350 && dist < 48) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        openRail();
        lastTap.t = 0;
        return true;
      }
      lastTap.t = now;
      lastTap.x = x;
      lastTap.y = y;
      return false;
    };

    const onTouch = (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (tryOpenRail(t.clientX, t.clientY, e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const onDblClick = (e) => {
      if (tryOpenRail(e.clientX, e.clientY, e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    layer.addEventListener('touchstart', onTouch, { passive: false });
    layer.addEventListener('dblclick', onDblClick);

    return () => {
      layer.removeEventListener('touchstart', onTouch);
      layer.removeEventListener('dblclick', onDblClick);
    };
  }, [technicianLoading, technicianError, openRail]);

  const { update, delete: deleteTechnician } = useTechnicianMutations();

  const [formData, setFormData] = useState({
    employee_id: '',
    status: 'active',
    hire_date: '',
    specialization: '',
  });

  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (technician) {
      setFormData({
        employee_id: technician.employee_id || '',
        status: technician.status || 'active',
        hire_date: technician.hire_date ? technician.hire_date.split('T')[0] : '',
        specialization: technician.specialization || '',
      });
    }
  }, [technician]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await update({ id, data: formData });
      setUpdateSuccess(true);
      setTimeout(() => {
        router.push(`/technicians/${id}/txmobile_view`);
      }, 1500);
    } catch (error) {
      console.error('Failed to update technician:', error);
      setSubmitError(error.message || 'Failed to update technician');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTechnician(id);
      router.push('/techboard/operatives');
    } catch (error) {
      console.error('Failed to delete technician:', error);
      setSubmitError(error.message || 'Failed to delete technician');
      setShowDeleteConfirm(false);
    }
  };

  if (technicianLoading || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0F1E' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (technicianError || !technician) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0A0F1E' }}>
        <div className="text-center">
          <p className="text-red-400">Failed to load technician</p>
          <button onClick={() => router.push('/techboard/operatives')} className="mt-4 text-cyan-400 hover:underline">
            Back to Operatives
          </button>
        </div>
      </div>
    );
  }

  const hasUserData = !!technician.user;
  const displayName = hasUserData ? `${technician.user.first_name} ${technician.user.last_name}` : technician.employee_id;

  return (
    <TechDashboardLayout>
      <Head>
        <title>Edit {displayName} | Field Tech Dashboard</title>
      </Head>

      <style jsx>{`
        @keyframes tactical-scan {
          0%, 100% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
        }
        .hud-tactical-scan-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(34, 211, 238, 0.5) 50%,
            transparent 100%
          );
          pointer-events: none;
          animation: tactical-scan 4s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
        }
        .edit-hud-titleplate-grid {
          background-image:
            linear-gradient(rgba(34, 211, 238, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.15) 1px, transparent 1px);
          background-size: 8px 8px;
        }
        .hud-tactical-column {
          touch-action: manipulation;
        }
      `}</style>

      <div className="min-h-screen pb-24" style={{ background: '#0A0F1E' }}>
        <div
          ref={tacticalColumnRef}
          className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto"
          style={{ minHeight: '100vh' }}
        >
          {/* Tactical background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: '#0A0F1E' }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.36)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
                bg-[size:42px_42px]"
            />
            <div
              className="absolute inset-0 opacity-[0.025]"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")' }}
            />
            <div className="hud-tactical-scan-line" />
          </div>

          <div 
            className="fixed top-0 left-0 right-0 z-20 edit-hud-titleplate-grid"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 12px)',
              paddingBottom: '12px',
              paddingLeft: '16px',
              paddingRight: '16px',
              background: 'rgba(10, 15, 30, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(34, 211, 238, 0.3)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href={`/technicians/${id}/txmobile_view`}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <FaArrowLeft size={20} />
                </Link>
                <h1 
                  className="text-lg font-bold uppercase tracking-widest truncate"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    color: '#22D3EE',
                    textShadow: '0 0 10px rgba(34,211,238,0.5)',
                  }}
                >
                  Edit Operative
                </h1>
              </div>
            </div>
          </div>

          <div 
            className="relative z-10"
            style={{
              marginTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
            }}
          >
            {updateSuccess && (
              <div 
                className="rounded-lg p-4 mb-4"
                style={{
                  background: 'rgba(34, 211, 238, 0.1)',
                  border: '1px solid rgba(34, 211, 238, 0.3)',
                  color: '#22D3EE',
                }}
              >
                Operative updated successfully! Redirecting...
              </div>
            )}

            {submitError && (
              <div 
                className="rounded-lg p-4 mb-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                }}
              >
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Operative Information */}
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
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide mb-4">Operative Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Employee ID *</label>
                    <input
                      type="text"
                      name="employee_id"
                      value={formData.employee_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 text-sm rounded border text-white"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(34, 211, 238, 0.3)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Status *</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 text-sm rounded border text-white"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(34, 211, 238, 0.3)',
                      }}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Hire Date</label>
                    <input
                      type="date"
                      name="hire_date"
                      value={formData.hire_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm rounded border text-white"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(34, 211, 238, 0.3)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Specialization</label>
                    <input
                      type="text"
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm rounded border text-white"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(34, 211, 238, 0.3)',
                      }}
                      placeholder="e.g. HVAC, Electrical, Plumbing"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(147, 51, 234, 0.25))',
                    border: '1px solid rgba(34, 211, 238, 0.5)',
                    color: '#22D3EE',
                    boxShadow: '0 0 20px rgba(34, 211, 238, 0.3)',
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>

                <Link
                  href={`/technicians/${id}/txmobile_view`}
                  className="block w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-center transition-all"
                  style={{
                    background: 'rgba(13, 21, 37, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#9CA3AF',
                  }}
                >
                  Cancel
                </Link>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                  }}
                >
                  Delete Operative
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="rounded-lg p-6 max-w-sm w-full"
            style={{
              background: 'rgba(13, 21, 37, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              boxShadow: '0 0 40px rgba(239, 68, 68, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-400">Confirm Delete</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to delete this operative? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#EF4444',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all"
                style={{
                  background: 'rgba(13, 21, 37, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#9CA3AF',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </TechDashboardLayout>
  );
}

export default TechnicianMobileEdit;
