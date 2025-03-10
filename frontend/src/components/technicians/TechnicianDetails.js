import { FaUser, FaEnvelope, FaPhone, FaCalendarAlt, FaTools, FaMapMarkerAlt, FaDollarSign, FaChartLine } from 'react-icons/fa';
import StatusBadge from '@/components/ui/StatusBadge';

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
              <h3 className="text-sm font-medium from 'react';
import Link from 'next/link';
import { FaEdit, FaEye, FaCalendarAlt, FaChartBar } from 'react-icons/fa';

export default function TechniciansTable({ technicians }) {
  if (!technicians || technicians.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No technicians found.
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Employee ID
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Skills
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {technicians.map((technician) => (
            <tr key={technician.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                <Link href={`/technicians/${technician.id}`}>
                  {technician.user?.first_name} {technician.user?.last_name}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {technician.employee_id || 'N/A'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                <div className="flex flex-wrap">
                  {technician.skills?.length > 3 && (
                    <span className="bg-gray-100 text-gray-800 text-xs font-medium ml-1 px-2 py-0.5 rounded">
                      +{technician.skills.length - 3} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  technician.status === 'active' ? 'bg-green-100 text-green-800' : 
                  technician.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {technician.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link 
                  href={`/technicians/${technician.id}/schedule`} 
                  className="text-green-600 hover:text-green-900 mr-3"
                  aria-label={`View schedule for ${technician.user?.first_name} ${technician.user?.last_name}`}
                >
                  <FaCalendarAlt className="inline mr-1" />
                  Schedule
                </Link>
                <Link 
                  href={`/technicians/${technician.id}/performance`} 
                  className="text-purple-600 hover:text-purple-900 mr-3"
                  aria-label={`View performance for ${technician.user?.first_name} ${technician.user?.last_name}`}
                >
                  <FaChartBar className="inline mr-1" />
                  Performance
                </Link>
                <Link 
                  href={`/technicians/${technician.id}`} 
                  className="text-blue-600 hover:text-blue-900 mr-3"
                >
                  <FaEye className="inline mr-1" />
                  View
                </Link>
                <Link 
                  href={`/technicians/${technician.id}/edit`} 
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <FaEdit className="inline mr-1" />
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}?.slice(0, 3).map((skill, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium mr-1 mb-1 px-2 py-0.5 rounded">
                      {skill}
                    </span>
                  ))}
                  {technician.skills