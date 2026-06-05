import { useQuery } from '@tanstack/react-query';
import { getDmaSuggestions } from '../services/api/dmaApi';

const STALE_MS = 5 * 60 * 1000;

function suggestionQueryKey({ equipmentMake, equipmentSubtype, workOrderId }) {
  return [
    'dmaSuggestions',
    (equipmentMake || '').trim().toLowerCase(),
    (equipmentSubtype || '').trim().toLowerCase(),
    workOrderId || null,
  ];
}

export function useDmaSuggestions({ equipmentMake, equipmentSubtype, workOrderId, enabled = true }) {
  const make = (equipmentMake || '').trim();
  const subtype = (equipmentSubtype || '').trim();
  const canSuggest = Boolean(make && subtype);

  return useQuery({
    queryKey: suggestionQueryKey({ equipmentMake: make, equipmentSubtype: subtype, workOrderId }),
    queryFn: () =>
      getDmaSuggestions({
        equipment_make: make,
        equipment_subtype: subtype,
        work_order_id: workOrderId || undefined,
      }),
    enabled: enabled && canSuggest,
    staleTime: STALE_MS,
  });
}

/** Warm DMA suggestions as soon as WO equipment fields are known (before Equipment tab opens). */
export function usePrefetchDmaSuggestions(workOrder) {
  const make = (workOrder?.equipment_make || '').trim();
  const subtype = (workOrder?.equipment_subtype || '').trim();
  const workOrderId = workOrder?.id;

  useDmaSuggestions({
    equipmentMake: make,
    equipmentSubtype: subtype,
    workOrderId,
    enabled: Boolean(make && subtype && workOrderId),
  });
}
