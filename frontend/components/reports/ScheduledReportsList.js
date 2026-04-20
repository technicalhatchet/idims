import { FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { format } from 'date-fns';

export default function ScheduledReportsList({ reports, onEdit, onDelete, onToggleActive }) {
  if (!reports || reports.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No scheduled reports found.</p>
        <p className="text-sm text-gray-500 mt-2">Create a new schedule to receive automated reports.</p>
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
              Report Type
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Frequency
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Recipients
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Next Run
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
          {reports.map((report) => (
            <tr key={report.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {report.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {report.report_type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {report.frequency}
                {report.frequency_details && ` (${report.frequency_details})`}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {report.recipients && report.recipients.length > 0 ? (
                  <span>{report.recipients.length} recipient{report.recipients.length > 1 ? 's' : ''}</span>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {report.next_run_date ? (
                  format(new Date(report.next_run_date), 'MMM d, yyyy h:mm a')
                ) : (
                  <span className="text-gray-400">Not scheduled</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  report.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {report.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onToggleActive(report)}
                  className={`mr-3 ${report.isActive ? 'text-green-600 hover:text-green-900' : 'text-gray-600 hover:text-gray-900'}`}
                  aria-label={`${report.isActive ? 'Deactivate' : 'Activate'} schedule`}
                >
                  {report.isActive ? <FaToggleOn className="w-5 h-5" /> : <FaToggleOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => onEdit(report)}
                  className="text-indigo-600 hover:text-indigo-900 mr-3"
                  aria-label="Edit schedule"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => onDelete(report)}
                  className="text-red-600 hover:text-red-900"
                  aria-label="Delete schedule"
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 