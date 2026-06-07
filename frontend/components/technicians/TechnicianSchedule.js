import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt } from 'react-icons/fa';
import TimelineView from '../schedule/TimelineView';
import EventDetailModal from '../schedule/EventDetailModal';

const btnInactive =
  'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600';
const btnMiddleInactive =
  'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600';
const btnActive = 'bg-blue-600 text-white dark:bg-blue-700';

function buildDayRange(ref) {
  const newStart = new Date(ref);
  newStart.setHours(0, 0, 0, 0);
  const newEnd = new Date(newStart);
  newEnd.setHours(23, 59, 59, 999);
  return [newStart, newEnd];
}

function buildWeekRange(ref) {
  const newStart = new Date(ref);
  const dayOfWeek = newStart.getDay();
  newStart.setDate(newStart.getDate() - dayOfWeek);
  newStart.setHours(0, 0, 0, 0);
  const newEnd = new Date(newStart);
  newEnd.setDate(newStart.getDate() + 6);
  newEnd.setHours(23, 59, 59, 999);
  return [newStart, newEnd];
}

/** Shape expected by TimelineView / FullCalendar pipeline */
function mapToTimelineAppointments(appointments, technicianName, technicianId) {
  return (appointments || []).map((a) => {
    const start = a.start_time;
    let end = a.end_time;
    if (start && !end) {
      end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    }
    return {
      id: a.id,
      start,
      end,
      start_time: start,
      end_time: end,
      work_order_id: a.work_order_id,
      order_number: a.order_number,
      appointment_type: a.appointment_type || 'appointment',
      client_name: a.client?.name,
      technician_name: technicianName,
      technician_id: technicianId,
      location: a.location,
      status: a.status,
      description: a.description,
      title: a.title,
      source: 'work_order',
    };
  });
}

function toDetailEvent(a, technicianName) {
  return {
    id: a.id,
    work_order_id: a.work_order_id,
    order_number: a.order_number,
    title: a.title,
    start: a.start_time,
    end: a.end_time,
    location: a.location,
    status: a.status,
    client_name: a.client?.name,
    technician_name: technicianName,
    description: a.description,
    appointment_type: a.appointment_type,
    source: 'work_order',
  };
}

export default function TechnicianSchedule({
  schedule,
  isLoadingSchedule,
  startDate,
  endDate,
  onDateRangeChange,
  technician,
  technicianId,
}) {
  const [displayMode, setDisplayMode] = useState('list'); // list | timeline
  const [timelineView, setTimelineView] = useState('week'); // day | week (timeline only)
  const [selectedEvent, setSelectedEvent] = useState(null);

  const technicianName = technician?.user
    ? `${technician.user.first_name || ''} ${technician.user.last_name || ''}`.trim()
    : '';

  const timelineAppointments = useMemo(
    () => mapToTimelineAppointments(schedule?.appointments, technicianName, technicianId),
    [schedule?.appointments, technicianName, technicianId]
  );

  const activateTimeline = (scale) => {
    setDisplayMode('timeline');
    setTimelineView(scale);
    const t = new Date();
    if (scale === 'day') {
      const [s, e] = buildDayRange(t);
      onDateRangeChange(s, e);
    } else {
      const [s, e] = buildWeekRange(t);
      onDateRangeChange(s, e);
    }
  };

  const handleTimelineScaleChange = (scale) => {
    setTimelineView(scale);
    const ref = new Date(startDate);
    if (scale === 'day') {
      onDateRangeChange(...buildDayRange(ref));
    } else {
      onDateRangeChange(...buildWeekRange(ref));
    }
  };

  const navigatePrevious = () => {
    if (timelineView === 'day') {
      const ref = new Date(startDate);
      ref.setDate(ref.getDate() - 1);
      onDateRangeChange(...buildDayRange(ref));
    } else {
      const ref = new Date(startDate);
      ref.setDate(ref.getDate() - 7);
      onDateRangeChange(...buildWeekRange(ref));
    }
  };

  const navigateNext = () => {
    if (timelineView === 'day') {
      const ref = new Date(startDate);
      ref.setDate(ref.getDate() + 1);
      onDateRangeChange(...buildDayRange(ref));
    } else {
      const ref = new Date(startDate);
      ref.setDate(ref.getDate() + 7);
      onDateRangeChange(...buildWeekRange(ref));
    }
  };

  const navigateToday = () => {
    const t = new Date();
    if (timelineView === 'day') {
      onDateRangeChange(...buildDayRange(t));
    } else {
      onDateRangeChange(...buildWeekRange(t));
    }
  };

  const handleTimelineEventClick = (extendedProps) => {
    setSelectedEvent({
      ...extendedProps,
      work_order_id: extendedProps.work_order_id,
    });
  };

  const shellClass =
    'bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-transparent dark:border-gray-700';

  const filtersList = (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
          <input
            type="date"
            value={startDate.toISOString().slice(0, 10)}
            onChange={(e) => onDateRangeChange(new Date(e.target.value), endDate)}
            className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
          <input
            type="date"
            value={endDate.toISOString().slice(0, 10)}
            onChange={(e) => onDateRangeChange(startDate, new Date(e.target.value))}
            className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>
    </div>
  );

  const modeToggle = (
    <div className="inline-flex rounded-md shadow-sm" role="group">
      <button
        type="button"
        onClick={() => setDisplayMode('list')}
        className={`px-4 py-2 text-sm font-medium rounded-l-lg ${displayMode === 'list' ? btnActive : btnInactive}`}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => {
          if (displayMode === 'list') activateTimeline('week');
        }}
        className={`px-4 py-2 text-sm font-medium rounded-r-lg ${displayMode === 'timeline' ? btnActive : btnInactive}`}
      >
        Timeline
      </button>
    </div>
  );

  const timelineDayWeekToggle = displayMode === 'timeline' && (
    <div className="inline-flex rounded-md shadow-sm" role="group">
      <button
        type="button"
        onClick={() => handleTimelineScaleChange('day')}
        className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
          timelineView === 'day' ? btnActive : btnInactive
        }`}
      >
        Day
      </button>
      <button
        type="button"
        onClick={() => handleTimelineScaleChange('week')}
        className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
          timelineView === 'week' ? btnActive : btnInactive
        }`}
      >
        Week
      </button>
    </div>
  );

  const timelineNav = displayMode === 'timeline' && (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={navigatePrevious}
          className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Previous"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={navigateToday}
          className="px-3 py-1 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Today
        </button>
        <button
          type="button"
          onClick={navigateNext}
          className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Next"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
        {timelineView === 'day' && format(startDate, 'MMMM d, yyyy')}
        {timelineView === 'week' && `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`}
      </div>
    </div>
  );

  if (displayMode === 'timeline') {
    return (
      <>
        <div className={shellClass}>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Schedule</h2>
              <div className="flex flex-wrap items-center gap-2">
                {modeToggle}
                {timelineDayWeekToggle}
              </div>
            </div>
            {timelineNav}
          </div>

          <TimelineView
            key={`${timelineView}-${startDate?.getTime?.()}-${endDate?.getTime?.()}`}
            appointments={timelineAppointments}
            date={startDate}
            onEventClick={handleTimelineEventClick}
            viewType={timelineView}
            isLoading={!!isLoadingSchedule}
          />
        </div>

        {selectedEvent && (
          <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </>
    );
  }

  /* ----- List mode ----- */
  if (!schedule || !schedule.appointments || schedule.appointments.length === 0) {
    return (
      <>
        <div className={shellClass}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Schedule</h2>
            {modeToggle}
          </div>
          {filtersList}
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-lg">No appointments scheduled in this period</p>
            <p className="mt-2">This technician has no work assigned during the selected date range.</p>
          </div>
        </div>
        {selectedEvent && (
          <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className={shellClass}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Schedule</h2>
          {modeToggle}
        </div>

        {filtersList}

        <div className="space-y-4">
          {schedule.appointments.map((appointment) => (
            <button
              type="button"
              key={appointment.id}
              onClick={() => setSelectedEvent(toDetailEvent(appointment, technicianName))}
              className="w-full text-left border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50/80 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors"
            >
              <div className="flex flex-col md:flex-row justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">{appointment.title}</h3>
                  <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <FaCalendarAlt className="mr-2 text-gray-400 dark:text-gray-500" />
                    {format(parseISO(appointment.start_time), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <FaClock className="mr-2 text-gray-400 dark:text-gray-500" />
                    {format(parseISO(appointment.start_time), 'h:mm a')} -
                    {appointment.end_time ? format(parseISO(appointment.end_time), ' h:mm a') : ' TBD'}
                  </div>
                  {appointment.location && (
                    <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <FaMapMarkerAlt className="mr-2 text-gray-400 dark:text-gray-500" />
                      {appointment.location}
                    </div>
                  )}
                </div>
                <div className="mt-3 md:mt-0 md:ml-4">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      appointment.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : appointment.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : appointment.status === 'canceled'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}
                  >
                    {appointment.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {appointment.client && (
                <div className="mt-3 text-sm text-gray-800 dark:text-gray-200">
                  <span className="text-gray-500 dark:text-gray-400">Client:</span> {appointment.client.name}
                </div>
              )}
              {appointment.description && (
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{appointment.description}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}
