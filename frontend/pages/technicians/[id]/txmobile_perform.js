import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FaArrowLeft, FaCheckCircle, FaClock, FaStar, FaChartLine } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import TechnicianMobileShell, { TX_MOBILE_PAGE_BG } from '../../../components/technicians/TechnicianMobileShell';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useTechnician, useTechnicianPerformance } from '../../../hooks/useTechnicians';
import { TX_ORANGE } from '../../../constants/technicianMobileTheme';

function TechnicianMobilePerform() {
  const router = useRouter();
  const { id } = router.query;
  const [period, setPeriod] = useState('month');

  const { data: technician, isLoading, error } = useTechnician(id);
  const { data: performance, isLoading: performanceLoading, error: performanceError } = useTechnicianPerformance(id, period);

  if (isLoading || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: TX_MOBILE_PAGE_BG }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !technician) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: TX_MOBILE_PAGE_BG }}>
        <button type="button" onClick={() => router.push('/techboard/operatives')} className="text-orange-400">
          Back to Operatives
        </button>
      </div>
    );
  }

  const displayName = technician.user
    ? `${technician.user.first_name} ${technician.user.last_name}`
    : technician.employee_id;

  return (
    <TechnicianMobileShell
      title={`Performance - ${displayName} | Field Tech Dashboard`}
      scanKey="tx-perform"
      syncKey={`${id}-${period}`}
      titleplate={
        <div className="flex items-center gap-3">
          <Link href={`/technicians/${id}/txmobile_view`} className="text-orange-400" data-hud-card>
            <FaArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="tx-perform-hud-orbitron text-[8px] uppercase tracking-[0.2em] text-orange-300/95 mb-1">Performance</p>
            <h1 className="tx-perform-hud-orbitron text-base font-black uppercase tracking-[0.08em] text-white truncate">{displayName}</h1>
          </div>
        </div>
      }
    >
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" data-hud-card>
        {['week', 'month', 'quarter', 'year'].map((periodOption) => (
          <button
            key={periodOption}
            type="button"
            onClick={() => setPeriod(periodOption)}
            className="px-4 py-2 text-xs uppercase tracking-wide font-medium rounded-lg whitespace-nowrap"
            style={{
              background: period === periodOption ? TX_ORANGE.fillStrong : 'rgba(13, 21, 37, 0.4)',
              border: `1px solid ${period === periodOption ? TX_ORANGE.borderStrong : 'rgba(255,255,255,0.1)'}`,
              color: period === periodOption ? TX_ORANGE.primary : '#9CA3AF',
            }}
          >
            {periodOption}
          </button>
        ))}
      </div>

      {performanceLoading ? (
        <div className="text-center py-8" data-hud-card><LoadingSpinner /></div>
      ) : performanceError || !performance ? (
        <div className="rounded-lg p-4 text-red-400 border border-red-400/30 bg-red-400/10" data-hud-card>
          Failed to load performance data
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { icon: FaCheckCircle, label: 'Completed', value: performance.completed_jobs || 0 },
              { icon: FaClock, label: 'Avg Time', value: performance.avg_completion_time || 'N/A' },
              { icon: FaStar, label: 'Rating', value: performance.avg_rating ? `${performance.avg_rating.toFixed(1)}/5` : 'N/A' },
              { icon: FaChartLine, label: 'Efficiency', value: performance.efficiency_score ? `${performance.efficiency_score}%` : 'N/A' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg p-4 border border-orange-400/30 bg-[rgba(13,21,37,0.85)]" data-hud-card>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="text-orange-400" size={16} />
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          {performance.details && (
            <div className="rounded-lg p-4 border border-orange-400/30 bg-[rgba(13,21,37,0.85)]" data-hud-card>
              <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wide mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(performance.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <span className="text-gray-400">{key.replace(/_/g, ' ')}</span>
                    <span className="text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </TechnicianMobileShell>
  );
}

TechnicianMobilePerform.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default TechnicianMobilePerform;
