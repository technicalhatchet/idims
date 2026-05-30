import { useEffect, useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { getWorkOrderMileage } from '../../services/api/jobEconomicsApi';
import AppointmentMileageForm from './AppointmentMileageForm';

export default function WorkOrderMileageSection({ workOrder, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  const [mileageByAppt, setMileageByAppt] = useState({});
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openApptId, setOpenApptId] = useState(null);

  useEffect(() => {
    if (!workOrder?.id) return;
    getWorkOrderMileage(workOrder.id)
      .then((data) => {
        const map = {};
        (data?.items || []).forEach((m) => {
          map[m.appointment_id] = m;
        });
        setMileageByAppt(map);
      })
      .catch(() => setMileageByAppt({}));
  }, [workOrder?.id]);

  const appointments = [...(workOrder?.appointments || [])].sort(
    (a, b) => new Date(a.scheduled_start || 0) - new Date(b.scheduled_start || 0)
  );

  if (!appointments.length) return null;

  const visitSummary = (appt) => {
    const m = mileageByAppt[appt.id];
    const type = appt.appointment_type || 'Visit';
    const when = appt.scheduled_start
      ? new Date(appt.scheduled_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : 'Scheduled';
    const miles = m?.miles != null ? `${Number(m.miles)} mi` : '—';
    return `${type} · ${when} · ${miles}`;
  };

  return (
    <div className={`rounded-xl overflow-hidden ${isMobile ? 'border border-cyan-500/20 bg-[#0D1525]' : 'border border-gray-200 bg-gray-50'}`}>
      <button
        type="button"
        onClick={() => setSectionOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left ${isMobile ? 'hover:bg-cyan-950/30' : 'hover:bg-gray-100'}`}
      >
        <span className={`text-sm font-semibold ${isMobile ? 'text-cyan-300' : 'text-gray-900'}`}>
          Mileage by visit ({appointments.length})
        </span>
        {sectionOpen ? (
          <FaChevronUp className={isMobile ? 'text-cyan-400' : 'text-gray-500'} />
        ) : (
          <FaChevronDown className={isMobile ? 'text-cyan-400' : 'text-gray-500'} />
        )}
      </button>

      {sectionOpen && (
        <div className={`px-4 pb-4 space-y-2 border-t ${isMobile ? 'border-cyan-500/15' : 'border-gray-200'}`}>
          {appointments.map((appt) => {
            const isOpen = openApptId === appt.id;
            return (
              <div
                key={appt.id}
                className={`rounded-lg overflow-hidden ${isMobile ? 'border border-white/5 bg-black/20' : 'border border-gray-200 bg-white'}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenApptId(isOpen ? null : appt.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left ${isMobile ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                >
                  <span className={`text-xs font-medium truncate ${isMobile ? 'text-gray-300' : 'text-gray-700'}`}>
                    {visitSummary(appt)}
                  </span>
                  {isOpen ? (
                    <FaChevronUp className="shrink-0 text-xs text-gray-500" />
                  ) : (
                    <FaChevronDown className="shrink-0 text-xs text-gray-500" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3">
                    <AppointmentMileageForm
                      appointment={{ ...appt, mileage: mileageByAppt[appt.id] }}
                      variant={variant}
                      embedded
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
