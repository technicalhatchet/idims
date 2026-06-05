import { useQuery } from '@tanstack/react-query';
import { getExpenseCategories, getExpenseVendors, getJobEconomics } from '../services/api/jobEconomicsApi';

const STALE_MS = 10 * 60 * 1000;

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expenseCategories'],
    queryFn: getExpenseCategories,
    staleTime: STALE_MS,
    select: (data) => data?.items || [],
  });
}

export function useExpenseVendors() {
  return useQuery({
    queryKey: ['expenseVendors'],
    queryFn: getExpenseVendors,
    staleTime: STALE_MS,
    select: (data) => data?.items || [],
  });
}

export function useJobEconomics(workOrderId) {
  return useQuery({
    queryKey: ['jobEconomics', workOrderId],
    queryFn: () => getJobEconomics(workOrderId),
    enabled: !!workOrderId,
    staleTime: 60_000,
  });
}
