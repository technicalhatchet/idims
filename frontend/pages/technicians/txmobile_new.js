import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { useTechDashboardRail } from '../../components/layouts/TechDashboardLayout';
import { useTechnicianMutations } from '../../hooks/useTechnicians';
import { useUser } from '@auth0/nextjs-auth0/client';

const hudGridShiftForTitleplate = 0;

function TechnicianMobileNew() {
  const router = useRouter();
  const { user } = useUser();

  const tacticalColumnRef = useRef(null);
  const { openRail } = useTechDashboardRail() || {};

  // Attach double-tap listener
  useEffect(() => {
    if (!tacticalColumnRef.current || !openRail) return;

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
  }, [openRail]);

  const { create } = useTechnicianMutations();

  const [formData, setFormData] = useState({
    employee_id: '',
    status: 'active',
    hire_date: '',
    specialization: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await create(formData);
      router.push(`/technicians/${result.id}/txmobile_view`);
    } catch (error) {
      console.error('Failed to create technician:', error);
      setSubmitError(error.message || 'Failed to create technician');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TechDashboardLayout>
      <Head>
        <title>New Operative | Field Tech Dashboard</title>
      </Head>

      <style jsx>{`
        .new-tactical-scan {
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
        .new-hud-titleplate-grid {
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
          
          <div className="new-tactical-scan" />

          <div 
            className="fixed top-0 left-0 right-0 z-20 new-hud-titleplate-grid"
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
                  href="/techboard/operatives"
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
                  New Operative
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
              {/* User Information */}
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
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide mb-4">User Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">First Name *</label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
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
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
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
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
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
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm rounded border text-white"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(34, 211, 238, 0.3)',
                      }}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

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
                  {isSubmitting ? 'Creating...' : 'Create Operative'}
                </button>

                <Link
                  href="/techboard/operatives"
                  className="block w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-center transition-all"
                  style={{
                    background: 'rgba(13, 21, 37, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#9CA3AF',
                  }}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </TechDashboardLayout>
  );
}

export default TechnicianMobileNew;
