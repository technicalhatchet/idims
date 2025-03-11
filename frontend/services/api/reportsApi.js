import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get financial report
 */
export async function getFinancialReport(params = {}) {
  const { 
    startDate, 
    endDate, 
    reportType = 'summary', 
    format = 'json'
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  queryParams.append('report_type', reportType);
  queryParams.append('format', format);
  
  return apiClient(`${API_URL}/api/reports/financial?${queryParams.toString()}`);
}

/**
 * Get operations report
 */
export async function getOperationsReport(params = {}) {
  const { 
    startDate, 
    endDate, 
    reportType = 'summary', 
    format = 'json'
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  queryParams.append('report_type', reportType);
  queryParams.append('format', format);
  
  return apiClient(`${API_URL}/api/reports/operations?${queryParams.toString()}`);
}

/**
 * Get client report
 */
export async function getClientReport(clientId, params = {}) {
  const { 
    startDate, 
    endDate, 
    format = 'json'
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  queryParams.append('format', format);
  
  return apiClient(`${API_URL}/api/reports/clients/${clientId}?${queryParams.toString()}`);
}

/**
 * Get technician report
 */
export async function getTechnicianReport(technicianId, params = {}) {
  const { 
    startDate, 
    endDate, 
    format = 'json'
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  queryParams.append('format', format);
  
  return apiClient(`${API_URL}/api/reports/technicians/${technicianId}?${queryParams.toString()}`);
}

/**
 * Get inventory report
 */
export async function getInventoryReport(params = {}) {
  const { 
    startDate, 
    endDate, 
    category,
    reportType = 'summary',
    format = 'json'
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  queryParams.append('report_type', reportType);
  queryParams.append('format', format);
  
  if (category) queryParams.append('category', category);
  
  return apiClient(`${API_URL}/api/reports/inventory?${queryParams.toString()}`);
}

/**
 * Get list of saved reports
 */
export async function getSavedReports(reportType = null) {
  const queryParams = new URLSearchParams();
  if (reportType) queryParams.append('report_type', reportType);
  
  return apiClient(`${API_URL}/api/reports/saved?${queryParams.toString()}`);
}

/**
 * Get a specific saved report
 */
export async function getSavedReport(reportType, reportId, fileName) {
  return apiClient(`${API_URL}/api/reports/saved/${reportType}/${reportId}/${fileName}`);
}

/**
 * Generate custom report
 */
export async function generateCustomReport(reportConfig) {
  return apiClient(`${API_URL}/api/reports/generate`, {
    method: 'POST',
    body: JSON.stringify(reportConfig),
  });
}

/**
 * Download report as file
 */
export async function downloadReport(reportId, format = 'pdf') {
  const queryParams = new URLSearchParams();
  queryParams.append('format', format);
  
  return apiClient(`${API_URL}/api/reports/download/${reportId}?${queryParams.toString()}`);
}

/**
 * Schedule recurring report
 */
export async function scheduleReport(scheduleConfig) {
  return apiClient(`${API_URL}/api/reports/schedule`, {
    method: 'POST',
    body: JSON.stringify(scheduleConfig),
  });
}

/**
 * Get scheduled reports
 */
export async function getScheduledReports() {
  return apiClient(`${API_URL}/api/reports/scheduled`);
}

/**
 * Update scheduled report
 */
export async function updateScheduledReport(scheduleId, scheduleConfig) {
  return apiClient(`${API_URL}/api/reports/scheduled/${scheduleId}`, {
    method: 'PUT',
    body: JSON.stringify(scheduleConfig),
  });
}

/**
 * Delete scheduled report
 */
export async function deleteScheduledReport(scheduleId) {
  return apiClient(`${API_URL}/api/reports/scheduled/${scheduleId}`, {
    method: 'DELETE',
  });
}
