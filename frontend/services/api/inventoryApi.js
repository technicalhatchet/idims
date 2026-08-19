import { apiClient } from '../../utils/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export async function getInventoryCategories() {
  return apiClient('inventory/categories');
}

export async function getInventoryItems(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.search) query.append('search', params.search);
  if (params.category_id) query.append('category_id', params.category_id);
  if (params.low_stock_only) query.append('low_stock_only', 'true');
  if (params.include_inactive) query.append('include_inactive', 'true');
  const qs = query.toString();
  return apiClient(`inventory/items${qs ? `?${qs}` : ''}`);
}

export async function getLowStockItems() {
  return apiClient('inventory/items/low-stock');
}

export async function createInventoryItem(payload) {
  return apiClient('inventory/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateInventoryItem(id, payload) {
  return apiClient(`inventory/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adjustInventoryStock(id, payload) {
  return apiClient(`inventory/items/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function useInventoryCategories() {
  return useQuery({
    queryKey: ['inventory-categories'],
    queryFn: getInventoryCategories,
  });
}

export function useInventoryItems(params = {}) {
  return useQuery({
    queryKey: ['inventory-items', params],
    queryFn: () => getInventoryItems(params),
  });
}

export function useLowStockItems() {
  return useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: getLowStockItems,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
    },
  });
}

export function useAdjustInventoryStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => adjustInventoryStock(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
    },
  });
}
