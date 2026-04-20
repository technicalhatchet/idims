import { format } from 'date-fns';
import { FaEye, FaDownload } from 'react-icons/fa';

export default function ReportsTable({ reports = [], onView, onDownload }) {
  if (!reports.length) {
    return (
      <div className="bg-white shadow overflow-hidden rounded-lg py-10 text-center border">
        <p className="text-gray-500">No reports found</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Report Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created By
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created Date
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => {
              // Format created date
              const formattedDate = report.created_at 
                ? format(new Date(report.created_at), 'MMM d, yyyy')
                : 'N/A';
                
              // Format report type for display
              const reportTypeDisplay = report.type
                ? report.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                : 'N/A';
                
              return (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => onView && onView(report)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      {report.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {reportTypeDisplay}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {report.created_by_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formattedDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onView && onView(report)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="View report"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => onDownload && onDownload(report)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                        title="Download report"
                      >
                        <FaDownload />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 