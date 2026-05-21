import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaEdit, FaUser, FaChevronDown, FaChevronUp, FaIdCard, FaPhone, FaEnvelope, FaCalendar } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import { useTechDashboardRail } from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useTechnician } from '../../../hooks/useTechnicians';
import { useUser } from '@auth0/nextjs-auth0/client';

const hudGridShiftForTitleplate = 0;

function TechnicianMobileView() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();

  const [activeSection, setActiveSection] = useState('details');

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
        <title>{displayName} | Field Tech Dashboard</title>
      </Head>

      <style jsx>{`
        .technician-tactical-scan {
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
        .technician-hud-titleplate-grid {
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
          
          <div className="technician-tactical-scan" />

          <div 
            className="fixed top-0 left-0 right-0 z-20 technician-hud-titleplate-grid"
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
                  Operative Profile
                </h1>
              </div>
              <Link
                href={`/technicians/${id}/txmobile_edit`}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <FaEdit size={20} />
              </Link>
            </div>
          </div>

          <div 
            className="relative z-10"
            style={{
              marginTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
            }}
          >
            {/* Details Section */}
            <div 
              className="rounded-lg mb-4 overflow-hidden"
              style={{
                background: 'rgba(13, 21, 37, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
              }}
            >
              <button
                onClick={() => setActiveSection(activeSection === 'details' ? '' : 'details')}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <FaUser className="text-cyan-400" />
                  <span className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Details</span>
                </div>
                {activeSection === 'details' ? <FaChevronUp className="text-cyan-400" /> : <FaChevronDown className="text-cyan-400" />}
              </button>
              
              {activeSection === 'details' && (
                <div className="px-4 pb-4 space-y-3 border-t border-cyan-900/30">
                  <div className="pt-3">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Name</label>
                    <p className="text-sm text-white">{displayName}</p>
                  </div>

                  {technician.employee_id && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                        <FaIdCard className="inline mr-1" />
                        Employee ID
                      </label>
                      <p className="text-sm text-white">{technician.employee_id}</p>
                    </div>
                  )}

                  {hasUserData && technician.user.email && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                        <FaEnvelope className="inline mr-1" />
                        Email
                      </label>
                      <p className="text-sm text-white">{technician.user.email}</p>
                    </div>
                  )}

                  {hasUserData && technician.user.phone && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                        <FaPhone className="inline mr-1" />
                        Phone
                      </label>
                      <p className="text-sm text-white">{technician.user.phone}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Status</label>
                    <span
                      className="inline-block px-2 py-1 text-xs uppercase tracking-wide font-medium rounded"
                      style={{
                        background: technician.status === 'active'
                          ? 'rgba(34, 211, 238, 0.15)'
                          : technician.status === 'inactive'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(251, 146, 60, 0.15)',
                        color: technician.status === 'active'
                          ? '#22D3EE'
                          : technician.status === 'inactive'
                          ? '#EF4444'
                          : '#FB923C',
                      }}
                    >
                      {technician.status || 'Unknown'}
                    </span>
                  </div>

                  {technician.hire_date && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                        <FaCalendar className="inline mr-1" />
                        Hire Date
                      </label>
                      <p className="text-sm text-white">{new Date(technician.hire_date).toLocaleDateString()}</p>
                    </div>
                  )}

                  {technician.specialization && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Specialization</label>
                      <p className="text-sm text-white">{technician.specialization}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TechDashboardLayout>
  );
}

export default TechnicianMobileView;
