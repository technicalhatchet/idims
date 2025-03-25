import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt } from 'react-icons/fa';

export default function TechnicianSchedule({ schedule, isLoading, startDate, endDate, onDateRangeChange }) {
  const [view, setView] = useState('day'); // 'day', 'week', 'month'
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!schedule || !schedule.appointments || schedule.appointments.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900">Schedule</h2>
          <div className="mt-2 sm:mt-0">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setView('day')}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                  view === 'day' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setView('week')}
                className={`px-4 py-2 text-sm font-medium ${
                  view === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setView('month')}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                  view === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={startDate.toISOString().slice(0, 10)}
                onChange={(e) => onDateRangeChange(new Date(e.target.value), endDate)}
                className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={endDate.toISOString().slice(0, 10)}
                onChange={(e) => onDateRangeChange(startDate, new Date(e.target.value))}
                className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
        
        <div className="text-center py-12 text-gray-500">
          <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg">No appointments scheduled in this period</p>
          <p className="mt-2">This technician has no work assigned during the selected date range.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Schedule</h2>
        <div className="mt-2 sm:mt-0">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setView('day')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                view === 'day' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setView('week')}
              className={`px-4 py-2 text-sm font-medium ${
                view === 'week' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView('month')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                view === 'month' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={startDate.toISOString().slice(0, 10)}
              onChange={(e) => onDateRangeChange(new Date(e.target.value), endDate)}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={endDate.toISOString().slice(0, 10)}
              onChange={(e) => onDateRangeChange(startDate, new Date(e.target.value))}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        {schedule.appointments.map((appointment) => (
          <div key={appointment.id} className="border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex flex-col md:flex-row justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{appointment.title}</h3>
                <div className="flex items-center mt-2 text-sm text-gray-500">
                  <FaCalendarAlt className="mr-2 text-gray-400" />
                  {format(parseISO(appointment.start_time), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center mt-1 text-sm text-gray-500">
                  <FaClock className="mr-2 text-gray-400" />
                  {format(parseISO(appointment.start_time), 'h:mm a')} - 
                  {appointment.end_time ? format(parseISO(appointment.end_time), ' h:mm a') : ' TBD'}
                </div>
                {appointment.location && (
                  <div className="flex items-center mt-1 text-sm text-gray-500">
                    <FaMapMarkerAlt className="mr-2 text-gray-400" />
                    {appointment.location}
                  </div>
                )}
              </div>
              <div className="mt-3 md:mt-0 md:ml-4">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  appointment.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  appointment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                  appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {appointment.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            {appointment.client && (
              <div className="mt-3 text-sm">
                <span className="text-gray-500">Client:</span> {appointment.client.name}
              </div>
            )}
            {appointment.description && (
              <div className="mt-2 text-sm text-gray-500">
                {appointment.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 