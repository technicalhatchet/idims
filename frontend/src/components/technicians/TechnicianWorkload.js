import { useState } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import StatusBadge from '@/components/ui/StatusBadge';

export default function TechnicianWorkload({ workload, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!workload || !workload.jobs) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No workload data available.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Workload Overview</h2>
        </div>
        
        <div className="px-6 py-5">
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              Date Range: {new Date(workload.date_range.start).toLocaleDateString()} - {new Date(workload.date_range.end).toLocaleDateString()}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Total Jobs</p>
              <p className="text-2xl font-semibold text-gray-900">{workload.total_jobs}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Completed Jobs</p>
              <p className="text-2xl font-semibold text-gray-900">{workload.completed_jobs}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">In Progress Jobs</p>
              <p className="text-2xl font-semibold text-gray-900">{workload.in_progress_jobs}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Utilization Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{workload.utilization_rate.toFixed(1)}%</p>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-base font-medium text-gray-900 mb-3">Jobs by Day</h3>
            <div className="grid grid-cols-7 gap-2">
              {Object.entries(workload.jobs_by_day).map(([date, count]) => (
                <div key={date} className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">{new Date(date).toLocaleDateString(undefined, { weekday: 'short' })}</p>
                  <p className="text-xs text-gray-500">{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  <p className="text-lg font-semibold text-blue-600">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Scheduled Jobs</h2>
        </div>
        
        <div className="px-6 py-5">
          {workload.jobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workload.jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        <Link href={`/work-orders/${job.id}`}>
                          {job.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.client_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.scheduled_start ? new Date(job.scheduled_start).toLocaleString() : 'Not scheduled'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.location || 'No location'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No scheduled jobs for this period.</p>
          )}
        </div>
      </div>
    </div>
  );
} text-red-800">Form submission error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{form.errors._form}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Form actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          icon={<FaTimes />}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={form.isSubmitting}
          disabled={form.isSubmitting}
          icon={<FaSave />}
        >
          {isEdit ? 'Update' : 'Create'} Technician
        </Button>
      </div>
    </form>
  );
}