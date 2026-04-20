import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiClient } from '../utils/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Fetch reports with optional type filter
 */
async function fetchReports(reportType) {
  const url = reportType 
    ? `${API_URL}/api/reports?type=${reportType}` 
    : `${API_URL}/api/reports`;
  
  return apiClient(url);
}

/**
 * Fetch a single report by ID
 */
async function fetchReport(id) {
  return apiClient(`${API_URL}/api/reports/${id}`);
}

/**
 * Generate a new report
 */
async function generateReport(reportData) {
  return apiClient(`${API_URL}/api/reports`, {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
}

/**
 * Download a report in the specified format
 */
async function downloadReport({ reportId, format = 'pdf' }) {
  const response = await fetch(`${API_URL}/api/reports/${reportId}/download?format=${format}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to download report');
  }
  
  // Handle the file download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `report-${reportId}.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  
  return { success: true };
}

/**
 * Hook for fetching saved reports
 */
export function useSavedReports(reportType, options = {}) {
  return useQuery(
    ['reports', reportType],
    () => fetchReports(reportType),
    {
      staleTime: 60000, // 1 minute
      ...options,
    }
  );
}

/**
 * Hook for fetching a single report
 */
export function useReport(id, options = {}) {
  return useQuery(
    ['report', id],
    () => fetchReport(id),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hook for generating a new report
 */
export function useGenerateReport() {
  const queryClient = useQueryClient();
  
  return useMutation(generateReport, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('reports');
      return data;
    },
  });
}

/**
 * Hook for downloading a report
 */
export function useDownloadReport() {
  return useMutation(downloadReport);
}

/**
 * Hook for scheduled reports
 */
export function useScheduledReports(options = {}) {
  return useQuery(
    'scheduledReports',
    () => apiClient(`${API_URL}/api/reports/schedules`),
    {
      staleTime: 300000, // 5 minutes
      ...options,
    }
  );
}

/**
 * Hook for creating a scheduled report
 */
export function useCreateScheduledReport() {
  const queryClient = useQueryClient();
  
  return useMutation(
    (scheduleData) => apiClient(`${API_URL}/api/reports/schedules`, {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('scheduledReports');
      },
    }
  );
}

/**
 * Hook for deleting a scheduled report
 */
export function useDeleteScheduledReport() {
  const queryClient = useQueryClient();
  
  return useMutation(
    (scheduleId) => apiClient(`${API_URL}/api/reports/schedules/${scheduleId}`, {
      method: 'DELETE',
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('scheduledReports');
      },
    }
  );
}