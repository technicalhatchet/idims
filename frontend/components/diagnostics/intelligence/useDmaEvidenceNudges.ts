import { useEffect, useMemo, useState } from 'react';
import { resolveDmaEquipmentSubtype } from './resolveDmaSubtype';
import { fetchDmaEvidenceNudges } from './dmaEvidenceApi';
import type { DmaEvidenceNudge } from './evidenceTypes';

export function useDmaEvidenceNudges({
  templateId,
  workOrder = null,
  activeTags = [],
  excludeWorkOrderId = null,
  enabled = true,
}: {
  templateId?: string | null;
  workOrder?: { equipment_make?: string; equipment_subtype?: string } | null;
  activeTags?: string[];
  excludeWorkOrderId?: string | number | null;
  enabled?: boolean;
}) {
  const [nudges, setNudges] = useState<DmaEvidenceNudge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const equipmentSubtype = useMemo(
    () => resolveDmaEquipmentSubtype(templateId, workOrder),
    [templateId, workOrder],
  );
  const equipmentMake = (workOrder?.equipment_make || '').trim() || null;
  const tagsKey = useMemo(
    () => [...new Set(activeTags.filter(Boolean))].sort().join(','),
    [activeTags],
  );

  useEffect(() => {
    if (!enabled || !equipmentSubtype || !tagsKey) {
      setNudges([]);
      setError(null);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchDmaEvidenceNudges({
      equipmentSubtype,
      equipmentMake,
      tags: tagsKey.split(',').filter(Boolean),
      excludeWorkOrderId,
    })
      .then((mapped) => {
        if (cancelled) return;
        setNudges(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setNudges([]);
          setError('Repair memory unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, equipmentSubtype, equipmentMake, tagsKey, excludeWorkOrderId]);

  return {
    nudges,
    isLoading,
    error,
    equipmentSubtype,
  };
}
