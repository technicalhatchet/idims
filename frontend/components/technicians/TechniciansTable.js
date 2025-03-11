import { useState } from 'react';
import Link from 'next/link';
import { FaEdit, FaEye, FaCalendarAlt, FaChartBar } from 'react-icons/fa';
import StatusBadge from '@/components/ui/StatusBadge';

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
                  {technician.skills?.slice(0, 3).map((skill, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium mr-1 mb-1 px-2 py-0.5 rounded">
                      {skill}
                    </span>
                  ))}
                  {technician.skills?.length > 3 && (
                    <span className="bg-gray-100 text-gray-800 text-xs font-medium ml-1 px-2 py-0.5 rounded">
                      +{technician.skills.length - 3} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={technician.status} />
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
}