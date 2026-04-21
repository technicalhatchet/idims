import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import { useUser } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { format, isToday } from 'date-fns';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { apiClient } from '../../utils/api-client';
import { getUserRole } from '../../utils/auth0-helpers';
import { FaPhone, FaMapMarkerAlt, FaCheckCircle, FaCalendarAlt, FaChevronDown, FaChevronUp, FaArrowLeft, FaClock, FaUser } from 'react-icons/fa';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'phone_payment', label: 'Phone Payment', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'canceled', label: 'Canceled', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { value: 'reschedule', label: 'Reschedule', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { value: 'refund', label: 'Refund', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
];

function getStatusStyle(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
}

function AppointmentCard({ appointment, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(appointment.status?.value || appointment.status || 'scheduled');

  const address = appointment.service_location?.address || appointment.location || '';
  const phone = appointment.client_phone || appointment.client?.phone || '';
  const clientName = appointment.client_name || appointment.client?.name || 'Client';
  const workOrderId = appointment.work_order_id;
  const startTime = appointment.scheduled_start ? new Date(appointment.scheduled_start) : null;
  const endTime = appointment.scheduled_end ? new Date(appointment.scheduled_end) : null;

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await apiClient(`work-orders/appointments/${appointment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setCurrentStatus(newStatus);
      if (onStatusChange) onStatusChange(appointment.id, newStatus);
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = () => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${encoded}`, '_blank');
  };

  const callClient = () => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  return (
    <div className={`rounded-xl shadow-md mb-4 overflow-hidden border-l-4 ${
      currentStatus === 'completed' ? 'border-green-500 opacity-75' :
      currentStatus === 'canceled' ? 'border-red-500 opacity-60' :
      currentStatus === 'phone_payment' ? 'border-yellow-500' :
      'border-blue-500'
    } bg-white dark:bg-gray-800`}>
      {/* Card Header - always visible */}
      <div className="p-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <FaClock className="text-gray-400 text-sm" />
              <span className="font-bold text-gray-900 dark:text-white text-lg">
                {startTime ? format(startTime, 'h:mm a') : 'TBD'}
                {endTime ? ` – ${format(endTime, 'h:mm a')}` : ''}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <FaUser className="text-gray-400 text-sm" />
              <span className="text-gray-700 dark:text-gray-300 font-medium">{clientName}</span>
            </div>
            {address && (
              <div className="flex items-center space-x-2 mt-1">
                <FaMapMarkerAlt className="text-gray-400 text-sm flex-shrink-0" />
                <span className="text-gray-500 dark:text-gray-400 text-sm truncate">{address}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(currentStatus)}`}>
              {STATUS_OPTIONS.find(s => s.value === currentStatus)?.label || currentStatus}
            </span>
            {expanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
            <button
              onClick={openMaps}
              disabled={!address}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed active:bg-blue-700"
            >
              <FaMapMarkerAlt />
              <span>Navigate</span>
            </button>
            <button
              onClick={callClient}
              disabled={!phone}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed active:bg-green-700"
            >
              <FaPhone />
              <span>Call</span>
            </button>
          </div>

          {/* Appointment type */}
          {appointment.appointment_type && (
            <div className="mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</span>
              <p className="text-gray-800 dark:text-gray-200 font-medium capitalize">{appointment.appointment_type}</p>
            </div>
          )}

          {/* Services */}
          {appointment.services && appointment.services.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Services</span>
              {appointment.services.map((s, i) => (
                <p key={i} className="text-gray-800 dark:text-gray-200 text-sm">{s.name}</p>
              ))}
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes</span>
              <p className="text-gray-800 dark:text-gray-200 text-sm">{appointment.notes}</p>
            </div>
          )}

          {/* Work order link */}
          {workOrderId && (
            <div className="mb-4">
              <Link
                href={`/work_orders/${workOrderId}`}
                className="text-blue-600 dark:text-blue-400 text-sm underline"
              >
                View Full Work Order →
              </Link>
            </div>
          )}

          {/* Status update */}
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">Update Status</span>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={updating || currentStatus === opt.value}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    currentStatus === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                  } disabled:opacity-50`}
                >
                  {updating && currentStatus !== opt.value ? '...' : opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TodaysRoute() {
  const { user, isLoading: authLoading } = useUser();

  // Add this at the top of the component, before other logic
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/api/auth/login';
    }
  }, [user, authLoading]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchWO, setSearchWO] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const userRole = user ? getUserRole(user) : null;
  const isTechnician = userRole === 'technician';

  // Fetch technicians list (admin/manager only)
  useEffect(() => {
    if (isTechnician) return;
    const fetchTechs = async () => {
      try {
        const res = await apiClient('technicians');
        setTechnicians(res?.items || []);
      } catch (err) {
        console.error('Error fetching technicians:', err);
      }
    };
    fetchTechs();
  }, [isTechnician]);

  // Auto-select current technician if user is a tech
  useEffect(() => {
    if (!isTechnician || !user) return;
    const findMyTech = async () => {
      try {
        const res = await apiClient('technicians');
        const techs = res?.items || [];
        const myTech = techs.find(t =>
          t.user?.email === user.email || t.user_email === user.email
        );
        if (myTech) setSelectedTechId(myTech.id);
      } catch (err) {
        console.error('Error finding technician:', err);
      }
    };
    findMyTech();
  }, [isTechnician, user]);

  // Fetch appointments for selected date and technician
  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let url = `scheduling/schedule?start_date=${date}&end_date=${date}&view_type=day`;
        if (selectedTechId) url += `&technician_id=${selectedTechId}`;
        const res = await apiClient(url);
        const appts = res?.appointments || [];
        // Sort by scheduled_start
        appts.sort((a, b) => new Date(a.start || a.scheduled_start) - new Date(b.start || b.scheduled_start));
        setAppointments(appts);

       
        if (appointments.length > 0) {
          console.log('First appointment:', JSON.stringify(appointments[0], null, 2));
        }
        
      } catch (err) {
        console.error('Error fetching appointments:', err);
        setError('Failed to load appointments.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAppointments();
  }, [date, selectedTechId]);

  const getTechName = (tech) => {
    if (tech?.user?.first_name || tech?.user?.last_name) {
      return `${tech.user.first_name || ''} ${tech.user.last_name || ''}`.trim();
    }
    return tech?.employee_id ? `Tech (${tech.employee_id})` : 'Unknown';
  };

  const filteredAppointments = searchWO
    ? appointments.filter(a =>
        a.order_number?.toLowerCase().includes(searchWO.toLowerCase()) ||
        a.work_order_id?.toLowerCase().includes(searchWO.toLowerCase())
      )
    : appointments;

  const isDateToday = date === format(new Date(), 'yyyy-MM-dd');

  return (
    <>
      <Head>
        <title>Today's Route | IDIMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Today's Route</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDateToday ? 'Today' : format(new Date(date + 'T12:00:00'), 'MMM d, yyyy')} · {filteredAppointments.length} stop{filteredAppointments.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 text-sm"
            >
              <FaArrowLeft className="text-xs" />
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
          />

          {/* Technician selector (admin/manager) */}
          {!isTechnician && (
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
            >
              <option value="">All Technicians</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>{getTechName(tech)}</option>
              ))}
            </select>
          )}

          {/* Work order search */}
          <input
            type="text"
            placeholder="Search by work order #..."
            value={searchWO}
            onChange={(e) => setSearchWO(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Appointments list */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500">{error}</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-16">
              <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No appointments for this day</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {selectedTechId ? 'Try selecting a different technician or date.' : 'Try selecting a different date.'}
              </p>
            </div>
          ) : (
            filteredAppointments.map((apt, i) => (
              <AppointmentCard
                key={apt.id || i}
                appointment={apt}
                onStatusChange={(id, status) => {
                  setAppointments(prev =>
                    prev.map(a => a.id === id ? { ...a, status } : a)
                  );
                }}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function TodaysRouteWithLayout(props) {
  return (
    <DashboardLayout>
      <TodaysRoute {...props} />
    </DashboardLayout>
  );
}
