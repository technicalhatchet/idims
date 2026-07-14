import { getDmaEvidenceNudges } from '../../../services/api/dmaApi';
import type { DmaEvidenceNudge } from './evidenceTypes';

type DmaEvidenceNudgesApiResponse = {
  equipment_subtype?: string | null;
  nudges?: Array<{ tag: string; label: string; case_count: number }>;
};

type GetDmaEvidenceNudgesArgs = {
  equipmentSubtype: string;
  equipmentMake?: string | null;
  tags?: string[];
  excludeWorkOrderId?: string | number | null;
};

const fetchNudges = getDmaEvidenceNudges as (args: GetDmaEvidenceNudgesArgs) => Promise<DmaEvidenceNudgesApiResponse>;

export async function fetchDmaEvidenceNudges(args: {
  equipmentSubtype: string;
  equipmentMake?: string | null;
  tags: string[];
  excludeWorkOrderId?: string | number | null;
}): Promise<DmaEvidenceNudge[]> {
  const result = await fetchNudges({
    equipmentSubtype: args.equipmentSubtype,
    equipmentMake: args.equipmentMake || null,
    tags: args.tags,
    excludeWorkOrderId: args.excludeWorkOrderId || null,
  });

  return (result?.nudges || []).map((row) => ({
    tag: row.tag,
    label: row.label,
    caseCount: row.case_count,
  }));
}
