import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaChartLine, FaClock, FaCheckCircle, FaStar } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import { useTechDashboardRail } from '../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useTechnician, useTechnicianPerformance } from '../../../hooks/useTechnicians';
import { useUser } from '@auth0/nextjs-auth0/client';

const hudGridShiftForTitleplate = 0;

function TechnicianMobilePerform() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [period, setPeriod] = useState('month');

  const { data: technician, isLoading: technicianLoading, error: technicianError } = useTechnician(id);
  const { data: performance, isLoading: performanceLoading, error: performanceError } = useTechnicianPerformance(id, period);

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
        <title>Performance - {displayName} | Field Tech Dashboard</title>
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
        .perform-hud-titleplate-grid {
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
            className="fixed top-0 left-0 right-0 z-20 perform-hud-titleplate-grid"
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
                  Performance
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
            {/* Period Filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {['week', 'month', 'quarter', 'year'].map((periodOption) => (
                <button
                  key={periodOption}
                  onClick={() => setPeriod(periodOption)}
                  className="px-4 py-2 text-xs uppercase tracking-wide font-medium rounded-lg whitespace-nowrap transition-all"
                  style={{
                    background: period === periodOption
                      ? 'rgba(34, 211, 238, 0.25)'
                      : 'rgba(13, 21, 37, 0.4)',
                    border: `1px solid ${period === periodOption ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: period === periodOption ? '#22D3EE' : '#9CA3AF',
                  }}
                >
                  {periodOption}
                </button>
              ))}
            </div>

            {performanceLoading ? (
              <div className="text-center py-8">
                <LoadingSpinner />
              </div>
            ) : performanceError || !performance ? (
              <div 
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                }}
              >
                Failed to load performance data
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div 
                    className="rounded-lg p-4"
                    style={{
                      background: 'rgba(13, 21, 37, 0.85)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(34, 211, 238, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FaCheckCircle className="text-cyan-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Completed</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{performance.completed_jobs || 0}</p>
                  </div>

                  <div 
                    className="rounded-lg p-4"
                    style={{
                      background: 'rgba(13, 21, 37, 0.85)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(34, 211, 238, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FaClock className="text-cyan-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Avg Time</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{performance.avg_completion_time || 'N/A'}</p>
                  </div>

                  <div 
                    className="rounded-lg p-4"
                    style={{
                      background: 'rgba(13, 21, 37, 0.85)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(34, 211, 238, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FaStar className="text-cyan-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Rating</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{performance.avg_rating ? `${performance.avg_rating.toFixed(1)}/5` : 'N/A'}</p>
                  </div>

                  <div 
                    className="rounded-lg p-4"
                    style={{
                      background: 'rgba(13, 21, 37, 0.85)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(34, 211, 238, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FaChartLine className="text-cyan-400" size={16} />
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Efficiency</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{performance.efficiency_score ? `${performance.efficiency_score}%` : 'N/A'}</p>
                  </div>
                </div>

                {/* Additional Details */}
                {performance.details && (
                  <div 
                    className="rounded-lg p-4"
                    style={{
                      background: 'rgba(13, 21, 37, 0.85)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(34, 211, 238, 0.3)',
                    }}
                  >
                    <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wide mb-3">Details</h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(performance.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-400">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </TechDashboardLayout>
  );
}

export default TechnicianMobilePerform;
