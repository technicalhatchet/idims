import { useEffect, useState } from 'react';
import { getWorkOrderMileage } from '../../services/api/jobEconomicsApi';
import AppointmentMileageForm from './AppointmentMileageForm';

export default function WorkOrderMileageSection({ workOrder, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  const [mileageByAppt, setMileageByAppt] = useState({});

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

  const appointments = workOrder?.appointments || [];
  if (!appointments.length) return null;

  return (
    <div className={`mt-4 rounded-xl p-4 ${isMobile ? 'border border-cyan-500/20 bg-[#0D1525]' : 'border border-gray-200 bg-gray-50'}`}>
      <h3 className={`text-sm font-semibold mb-3 ${isMobile ? 'text-cyan-300' : 'text-gray-900'}`}>Mileage by visit</h3>
      <div className="space-y-4">
        {appointments.map((appt) => (
          <div key={appt.id} className={`rounded-lg p-3 ${isMobile ? 'bg-black/20' : 'bg-white border border-gray-200'}`}>
            <p className={`text-xs font-medium mb-1 ${isMobile ? 'text-gray-300' : 'text-gray-700'}`}>
              {appt.appointment_type || 'Visit'} · {appt.scheduled_start ? new Date(appt.scheduled_start).toLocaleString() : 'Scheduled'}
            </p>
            <AppointmentMileageForm
              appointment={{ ...appt, mileage: mileageByAppt[appt.id] }}
              variant={variant}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
