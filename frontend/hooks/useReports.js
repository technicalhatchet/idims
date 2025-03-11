import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  getFinancialReport, 
  getOperationsReport, 
  getClientReport,
  getTechnicianReport,
  getInventoryReport,
  getSavedReports,
  getSavedReport,
  generateCustomReport,
  downloadReport,
  scheduleReport,
  getScheduledReports,
  updateScheduledReport,
  deleteScheduledReport
} from '@/services/api/reportsApi';

/**
 * Hook for financial report
 */
export function useFinancialReport(params = {}, options = {}) {
  const { startDate, endDate, reportType, format } = params;
  
  return useQuery(
    ['financialReport', startDate?.toISOString(), endDate?.toISOString(), reportType, format],
    () => getFinancialReport(params),
    {
      enabled: !!startDate && !!endDate,
      ...options,
    }
  );
}

/**
 * Hook for operations report
 */
export function useOperationsReport(params = {}, options = {}) {
  const { startDate, endDate, reportType, format } = params;
  
  return useQuery(
    ['operationsReport', startDate?.toISOString(), endDate?.toISOString(), reportType, format],
    () => getOperationsReport(params),
    {
      enabled: !!startDate && !!endDate,
      ...options,
    }
  );
}

/**
 * Hook for client report
 */
export function useClientReport(clientId, params = {}, options = {}) {
  const { startDate, endDate, format } = params;
  
  return useQuery(
    ['clientReport', clientId, startDate?.toISOString(), endDate?.toISOString(), format],
    () => getClientReport(clientId, params),
    {
      enabled: !!clientId && !!startDate && !!endDate,
      ...options,
    }
  );
}

/**
 * Hook for technician report
 */
export function useTechnicianReport(technicianId, params = {}, options = {}) {
  const { startDate, endDate, format } = params;
  
  return useQuery(
    ['technicianReport', technicianId, startDate?.toISOString(), endDate?.toISOString(), format],
    () => getTechnicianReport(technicianId, params),
    {
      enabled: !!technicianId && !!startDate && !!endDate,
      ...options,
    }
  );
}

/**
 * Hook for inventory report
 */
export function useInventoryReport(params = {}, options = {}) {
  const { startDate, endDate, category, reportType, format } = params;
  
  return useQuery(
    ['inventoryReport', startDate?.toISOString(), endDate?.toISOString(), category, reportType, format],
    () => getInventoryReport(params),
    {
      enabled: !!startDate && !!endDate,
      ...options,
    }
  );
}

/**
 * Hook for saved reports list
 */
export function useSavedReports(reportType = null, options = {}) {
  return useQuery(
    ['savedReports', reportType],
    () => getSavedReports(reportType),
    options
  );
}

/**
 * Hook for a specific saved report
 */
export function useSavedReport(reportType, reportId, fileName, options = {}) {
  return useQuery(
    ['savedReport', reportType, reportId, fileName],
    () => getSavedReport(reportType, reportId, fileName),
    {
      enabled: !!reportType && !!reportId && !!fileName,
      ...options,
    }
  );
}

/**
 * Hook for generating custom reports
 */
export function useGenerateCustomReport() {
  const queryClient = useQueryClient();
  
  return useMutation(generateCustomReport, {
    onSuccess: () => {
      // Invalidate saved reports query to refresh the list
      queryClient.invalidateQueries('savedReports');
    },
  });
}

/**
 * Hook for downloading a report
 */
export function useDownloadReport() {
  return useMutation(({ reportId, format }) => downloadReport(reportId, format));
}

/**
 * Hook for scheduled reports
 */
export function useScheduledReports(options = {}) {
  return useQuery(
    ['scheduledReports'],
    () => getScheduledReports(),
    options
  );
}

/**
 * Hook for scheduling a report
 */
export function useScheduleReport() {
  const queryClient = useQueryClient();
  
  return useMutation(scheduleReport, {
    onSuccess: () => {
      queryClient.invalidateQueries('scheduledReports');
    },
  });
}

/**
 * Hook for updating a scheduled report
 */
export function useUpdateScheduledReport() {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ scheduleId, scheduleConfig }) => updateScheduledReport(scheduleId, scheduleConfig),
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
  
  return useMutation(deleteScheduledReport, {
    onSuccess: () => {
      queryClient.invalidateQueries('scheduledReports');
    },
  });
}