import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import TechnicianMobileShell, { TX_MOBILE_PAGE_BG } from '../../../components/technicians/TechnicianMobileShell';
import TechnicianFieldPerformance from '../../../components/technicians/TechnicianFieldPerformance';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useTechnician, useTechnicianPerformance } from '../../../hooks/useTechnicians';

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
      {performanceLoading ? (
        <div className="text-center py-8" data-hud-card><LoadingSpinner /></div>
      ) : performanceError || !performance ? (
        <div className="rounded-lg p-4 text-red-400 border border-red-400/30 bg-red-400/10" data-hud-card>
          Failed to load performance data
        </div>
      ) : (
        <TechnicianFieldPerformance
          performance={performance}
          period={period}
          onPeriodChange={setPeriod}
          variant="mobile"
          showHeader={false}
        />
      )}
    </TechnicianMobileShell>
  );
}

TechnicianMobilePerform.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default TechnicianMobilePerform;
