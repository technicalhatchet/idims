import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/api-client';

export const AWAITING_PAYMENT_QUERY_KEY = ['billing', 'awaiting-payment'];

/**
 * Jobs with money owed now (Awaiting Pay tile + list), oldest first.
 * Backend: GET billing/awaiting-payment →
 *   { count, total_due, total_later, over_30, items: [{ id, order_number, client, phone,
 *     appliance, balance_due, due_later, days_open, pay_url, last_send }] }
 */
export function useAwaitingPayment({ enabled = true } = {}) {
  return useQuery({
    queryKey: AWAITING_PAYMENT_QUERY_KEY,
    queryFn: () => apiClient('billing/awaiting-payment'),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
