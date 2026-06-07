import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import { format, addMinutes } from 'date-fns';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { normalizeStatusKey } from '../../utils/workOrderPermissions';
import { FaCalendarAlt, FaUser, FaClock, FaSearch } from 'react-icons/fa';

const TIME_WINDOWS = [
  { value: 'morning', label: 'Morning', hours: '8 AM – 12 PM', startHour: 8, endHour: 12 },
  { value: 'afternoon', label: 'Afternoon', hours: '12 PM – 5 PM', startHour: 12, endHour: 17 },
  { value: 'evening', label: 'Evening', hours: '5 PM – 8 PM', startHour: 17, endHour: 20 },
];

const DURATION_OPTIONS = [
  { value: 45, label: '45 min (Diagnostic)' },
  { value: 60, label: '60 min (Standard)' },
  { value: 90, label: '90 min (Extended)' },
  { value: 120, label: '2 hr (Repair)' },
];

function AvailabilityChecker() {
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return format(tomorrow, 'yyyy-MM-dd');
  });
  const [selectedWindow, setSelectedWindow] = useState('');
  const [duration, setDuration] = useState(60);
  const [slots, setSlots] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [techSchedule, setTechSchedule] = useState([]);

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        const response = await apiClient('technicians');
        setTechnicians(response?.items || []);
      } catch (err) {
        console.error('Error fetching technicians:', err);
      }
    };
    fetchTechnicians();
  }, []);

  useEffect(() => {
    if (!selectedDate || !selectedTechnicianId) { setTechSchedule([]); return; }
    const fetchSchedule = async () => {
      try {
        const response = await apiClient(
          `work-orders/appointments/schedule?technician_id=${selectedTechnicianId}&schedule_date=${selectedDate}`
        );
        setTechSchedule(Array.isArray(response) ? response : []);
      } catch (err) {
        console.error('Error fetching technician schedule:', err);
        setTechSchedule([]);
      }
    };
    fetchSchedule();
  }, [selectedDate, selectedTechnicianId]);

  const findAvailableSlots = () => {
    if (!selectedDate || !selectedWindow) { setError('Please select a date and time window.'); return; }
    setError(null);
    setIsLoading(true);
    try {
      const win = TIME_WINDOWS.find(w => w.value === selectedWindow);
      const base = new Date(selectedDate + 'T00:00:00');
      const windowStart = new Date(base); windowStart.setHours(win.startHour, 0, 0, 0);
      const windowEnd = new Date(base); windowEnd.setHours(win.endHour, 0, 0, 0);

      const busy = techSchedule
        .filter(apt => {
          const s = apt.status?.value || apt.status;
          return normalizeStatusKey(s) !== 'canceled';
        })
        .map(apt => ({ start: new Date(apt.scheduled_start), end: new Date(apt.scheduled_end) }))
        .sort((a, b) => a.start - b.start);

      const available = [];
      let cursor = new Date(windowStart);
      while (cursor < windowEnd) {
        const slotEnd = addMinutes(cursor, duration);
        if (slotEnd > windowEnd) break;
        const conflict = busy.find(apt => cursor < apt.end && slotEnd > apt.start);
        if (!conflict) {
          available.push({ start: new Date(cursor), end: new Date(slotEnd) });
          cursor = addMinutes(cursor, duration);
        } else {
          cursor = new Date(conflict.end);
        }
      }
      setSlots(available);
    } catch (err) {
      setError('Error calculating availability. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTechnicianName = (tech) => {
    if (tech?.user?.first_name || tech?.user?.last_name) {
      return `${tech.user.first_name || ''} ${tech.user.last_name || ''}`.trim();
    }
    return tech?.employee_id ? `Technician (${tech.employee_id})` : 'Unknown';
  };

  const selectedTech = technicians.find(t => t.id === selectedTechnicianId);
  const selectedWin = TIME_WINDOWS.find(w => w.value === selectedWindow);

  return (
    <>
      <Head><title>Availability Checker | IDIMS</title></Head>
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Availability Checker</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Check open slots before committing to a work order.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FaCalendarAlt className="inline mr-1" /> Date
              </label>
              <input
                type="date"
                value={selectedDate}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => { setSelectedDate(e.target.value); setSlots(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FaUser className="inline mr-1" /> Technician
              </label>
              <select
                value={selectedTechnicianId}
                onChange={(e) => { setSelectedTechnicianId(e.target.value); setSlots(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Any technician</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>{getTechnicianName(tech)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FaClock className="inline mr-1" /> Time Window
            </label>
            <div className="flex space-x-2">
              {TIME_WINDOWS.map(w => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => { setSelectedWindow(w.value); setSlots(null); }}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    selectedWindow === w.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <div>{w.label}</div>
                  <div className="text-xs opacity-75">{w.hours}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Visit Duration
            </label>
            <select
              value={duration}
              onChange={(e) => { setDuration(Number(e.target.value)); setSlots(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={findAvailableSlots}
            disabled={isLoading || !selectedDate || !selectedWindow}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <FaSearch className="mr-2" />
            {isLoading ? 'Checking...' : 'Check Availability'}
          </button>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {techSchedule.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <h2 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              {selectedTech ? `${getTechnicianName(selectedTech)}'s` : 'Existing'} appointments on{' '}
              {format(new Date(selectedDate + 'T12:00:00'), 'MMM d, yyyy')}
            </h2>
            <div className="space-y-2">
              {techSchedule
                .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
                .map((apt, i) => {
                  const status = apt.status?.value || apt.status;
                  return (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                      normalizeStatusKey(status) === 'canceled'
                        ? 'bg-gray-100 dark:bg-gray-700 opacity-50'
                        : 'bg-blue-50 dark:bg-blue-900/30'
                    }`}>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {format(new Date(apt.scheduled_start), 'h:mm a')} – {format(new Date(apt.scheduled_end), 'h:mm a')}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 capitalize">{status}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {slots !== null && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              {slots.length > 0
                ? `${slots.length} open slot${slots.length === 1 ? '' : 's'} in the ${selectedWin?.label} window`
                : `No open slots in the ${selectedWin?.label} window`}
            </h2>

            {slots.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FaClock className="mx-auto h-10 w-10 mb-3 text-gray-300 dark:text-gray-600" />
                <p>No availability in this window. Try a different date, window, or technician.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {slots.map((slot, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div>
                      <span className="font-medium text-green-800 dark:text-green-200">
                        {format(slot.start, 'h:mm a')} – {format(slot.end, 'h:mm a')}
                      </span>
                      <span className="ml-3 text-sm text-green-600 dark:text-green-400">
                        {duration} min
                      </span>
                    </div>
                    {selectedTech && (
                      <span className="text-sm text-green-700 dark:text-green-300">
                        {getTechnicianName(selectedTech)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              To book one of these slots, create a work order then use the appointment scheduler on the detail page.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context.req, context.res);
  if (!session) {
    return { redirect: { destination: '/api/auth/login', permanent: false } };
  }
  return { props: {} };
}

export default function AvailabilityWithLayout(props) {
  return (
    <DashboardLayout>
      <AvailabilityChecker {...props} />
    </DashboardLayout>
  );
}