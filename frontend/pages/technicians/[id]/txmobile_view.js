import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FaArrowLeft, FaEdit, FaUser, FaChevronDown, FaChevronUp, FaIdCard, FaPhone, FaEnvelope, FaCalendar, FaChartLine } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import TechnicianMobileShell, { TX_MOBILE_PAGE_BG } from '../../../components/technicians/TechnicianMobileShell';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useTechnician } from '../../../hooks/useTechnicians';

function TechnicianMobileView() {
  const router = useRouter();
  const { id } = router.query;
  const [activeSection, setActiveSection] = useState('details');
  const { data: technician, isLoading, error } = useTechnician(id);

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

  const hasUserData = !!technician.user;
  const displayName = hasUserData ? `${technician.user.first_name} ${technician.user.last_name}` : technician.employee_id;

  return (
    <TechnicianMobileShell
      title={`${displayName} | Field Tech Dashboard`}
      scanKey="tx-view"
      syncKey={id}
      titleplate={
        <div className="flex items-center justify-between gap-3">
          <Link href="/techboard/operatives" className="text-orange-400" data-hud-card>
            <FaArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <p className="tx-view-hud-orbitron text-[8px] uppercase tracking-[0.2em] text-orange-300/95 mb-1">Operative Profile</p>
            <h1 className="tx-view-hud-orbitron text-base font-black uppercase tracking-[0.08em] text-white truncate">{displayName}</h1>
          </div>
          <Link href={`/technicians/${id}/txmobile_edit`} className="text-orange-400" data-hud-card>
            <FaEdit size={18} />
          </Link>
        </div>
      }
    >
      <div className="rounded-lg mb-4 overflow-hidden border border-orange-400/30 bg-[rgba(13,21,37,0.85)]" data-hud-card>
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'details' ? '' : 'details')}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <FaUser className="text-orange-400" />
            <span className="text-sm font-bold text-orange-400 uppercase tracking-wide">Details</span>
          </div>
          {activeSection === 'details' ? <FaChevronUp className="text-orange-400" /> : <FaChevronDown className="text-orange-400" />}
        </button>

        {activeSection === 'details' && (
          <div className="px-4 pb-4 space-y-3 border-t border-orange-900/30">
            <div className="pt-3">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Name</label>
              <p className="text-sm text-white">{displayName}</p>
            </div>
            {technician.employee_id && (
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1"><FaIdCard className="inline mr-1" />Employee ID</label>
                <p className="text-sm text-white">{technician.employee_id}</p>
              </div>
            )}
            {hasUserData && technician.user.email && (
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1"><FaEnvelope className="inline mr-1" />Email</label>
                <p className="text-sm text-white">{technician.user.email}</p>
              </div>
            )}
            {hasUserData && technician.user.phone && (
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1"><FaPhone className="inline mr-1" />Phone</label>
                <p className="text-sm text-white">{technician.user.phone}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Status</label>
              <span className="inline-block px-2 py-1 text-xs uppercase tracking-wide font-medium rounded bg-orange-400/15 text-orange-400">
                {technician.status || 'Unknown'}
              </span>
            </div>
            {technician.hire_date && (
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1"><FaCalendar className="inline mr-1" />Hire Date</label>
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

      <Link
        href={`/technicians/${id}/txmobile_perform`}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-orange-400 border border-orange-400/40 bg-orange-400/10"
        data-hud-card
      >
        <FaChartLine />
        View Performance
      </Link>
    </TechnicianMobileShell>
  );
}

TechnicianMobileView.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default TechnicianMobileView;
