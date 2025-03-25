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
  
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Technician Details</h2>
          <div>
            <StatusBadge status={technician.status} />
          </div>
        </div>
        
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <div className="flex items-center">
                <FaUser className="text-gray-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Name</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900">
                {technician.user?.first_name} {technician.user?.last_name}
              </p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaEnvelope className="text-gray-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900">{technician.user?.email || 'N/A'}</p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaPhone className="text-gray-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Phone</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900">{technician.user?.phone || 'N/A'}</p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaCalendarAlt className="text-gray-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Employee ID</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900">{technician.employee_id || 'N/A'}</p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaDollarSign className="text-gray-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Hourly Rate</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900">
                {technician.hourly_rate ? `${technician.hourly_rate.toFixed(2)}` : 'N/A'}
              </p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaChartLine className="text-gray-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Max Daily Jobs</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900">{technician.max_daily_jobs || 'N/A'}</p>
            </div>
            
            <div>
              <div className="flex items-center">
                <FaMapMarkerAlt className="text-gray-400 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Service Radius</h3>
              </div>
              <p className="mt-1 text-sm text-gray-900">
                {technician.service_radius ? `${technician.service_radius} miles` : 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex items-center">
              <FaTools className="text-gray-400 mr-2" />
              <h3 className="text-sm font-medium text-gray-500">Skills</h3>
            </div>
            <div className="mt-2 flex flex-wrap">
              {technician.skills?.length > 0 ? (
                technician.skills.map((skill, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 mb-2 px-2.5 py-0.5 rounded">
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500">No skills listed</p>
              )}
            </div>
          </div>
          
          {technician.notes && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500">Notes</h3>
              <p className="mt-1 text-sm text-gray-900">{technician.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}