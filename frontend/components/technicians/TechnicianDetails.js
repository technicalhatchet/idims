import { FaUser, FaEnvelope, FaPhone, FaCalendarAlt, FaTools, FaMapMarkerAlt, FaDollarSign, FaChartLine } from 'react-icons/fa';
import StatusBadge from '../ui/StatusBadge';

export default function TechnicianDetails({ technician }) {
  if (!technician) {
    return (
      <div className="text-center py-4 text-gray-500">
        No technician data available.
      </div>
    );
  }
  
  const hasUserData = !!technician.user;
  
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden dark:bg-gray-800">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center dark:bg-gray-700 dark:border-gray-600">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Technician Details</h2>
          <div>
            <StatusBadge status={technician.status} />
          </div>
        </div>
        
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <div className="flex items-center">
                <FaUser className="text-gray-400 dark:text-gray-300 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {hasUserData ? 
                  `${technician.user.first_name || ''} ${technician.user.last_name || ''}` : 
                  'User data unavailable'}
              </p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaEnvelope className="text-gray-400 dark:text-gray-300 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {hasUserData && technician.user.email ? technician.user.email : 'N/A'}
              </p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaPhone className="text-gray-400 dark:text-gray-300 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {hasUserData && technician.user.phone ? technician.user.phone : 'N/A'}
              </p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaCalendarAlt className="text-gray-400 dark:text-gray-300 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee ID</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">{technician.employee_id || 'N/A'}</p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaDollarSign className="text-gray-400 dark:text-gray-300 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Hourly Rate</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {technician.hourly_rate ? `${technician.hourly_rate.toFixed(2)}` : 'N/A'}
              </p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaChartLine className="text-gray-400 dark:text-gray-300 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Max Daily Jobs</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">{technician.max_daily_jobs || 'N/A'}</p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaMapMarkerAlt className="text-gray-400 dark:text-gray-300 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Radius</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                {technician.service_radius ? `${technician.service_radius} miles` : 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex items-center">
              <FaTools className="text-gray-400 dark:text-gray-300 mr-2" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Skills</h3>
            </div>
            <div className="mt-2 flex flex-wrap">
              {technician.skills?.length > 0 ? (
                technician.skills.map((skill, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 mb-2 px-2.5 py-0.5 rounded dark:bg-blue-700 dark:text-blue-100">
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No skills listed</p>
              )}
            </div>
          </div>
          
          {technician.notes && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</h3>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-200">{technician.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}