import { useState } from 'react';
import { FaChartBar, FaChartLine, FaChartPie } from 'react-icons/fa';

export default function TechnicianPerformance({ performance, isLoading }) {
  const [period, setPeriod] = useState('month');
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!performance || !performance.metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No performance data available.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Performance Overview</h2>
          <div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="form-select rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
        </div>
        
        <div className="px-6 py-5">
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Period: <span className="font-medium text-gray-900 dark:text-white">{performance.period}</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Date Range: {new Date(performance.date_range.start).toLocaleDateString()} - {new Date(performance.date_range.end).toLocaleDateString()}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {performance.metrics.map((metric, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-300">{metric.name}</p>
                  {metric.comparison !== null && (
                    <div className={`flex items-center text-xs font-medium ${
                      metric.comparison > 0 ? 'text-green-600 dark:text-green-400' : metric.comparison < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {metric.comparison > 0 ? '↑' : metric.comparison < 0 ? '↓' : '→'}
                      <span className="ml-1">{Math.abs(metric.comparison).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metric.value}</p>
                {metric.target !== null && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                      <span>Target: {metric.target}</span>
                      <span>{((parseFloat(metric.value) / metric.target) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, ((parseFloat(metric.value) / metric.target) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {performance.completionTrend && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Completion Trend</h2>
          </div>
          
          <div className="px-6 py-5">
            <div className="h-64">
              {/* This would be a chart component, for now we'll use a placeholder */}
              <div className="flex justify-center items-center h-full bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-center">
                  <FaChartLine className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">Trend chart would render here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}