import batch1 from './seed/measurement-knowledge.json';
import batch2 from './seed/measurement-knowledge-batch2.json';
import batch3 from './seed/measurement-knowledge-batch3.json';
import batch4 from './seed/measurement-knowledge-batch4.json';
import batch5 from './seed/measurement-knowledge-batch5.json';
import batch6 from './seed/measurement-knowledge-batch6.json';
import batch7 from './seed/measurement-knowledge-batch7.json';
import batch8 from './seed/measurement-knowledge-batch8.json';
import batch9 from './seed/measurement-knowledge-batch9.json';
import batch10 from './seed/measurement-knowledge-batch10.json';
import batch11 from './seed/measurement-knowledge-batch11.json';
import batch12 from './seed/measurement-knowledge-batch12.json';
import batch13 from './seed/measurement-knowledge-batch13.json';
import batch14 from './seed/measurement-knowledge-batch14.json';
import batch15 from './seed/measurement-knowledge-batch15.json';
import refrigeratorElimination from './elimination/refrigerator.json';
import dishwasherElimination from './elimination/dishwasher.json';
import gasRangeElimination from './elimination/gas_range.json';
import electricDryerElimination from './elimination/electric_dryer.json';
import gasDryerElimination from './elimination/gas_dryer.json';
import electricRangeElimination from './elimination/electric_range.json';
import washerElimination from './elimination/washer.json';
import microwaveElimination from './elimination/microwave.json';
import standaloneFreezerElimination from './elimination/standalone_freezer.json';
import stackedLaundryElimination from './elimination/stacked_laundry.json';
import aioLaundryElimination from './elimination/aio_laundry.json';
import type {
  EliminationConfig,
  MeasurementKnowledgeDefinition,
} from './types';

function normalizeKnowledgeEntry(
  entry: MeasurementKnowledgeDefinition,
): MeasurementKnowledgeDefinition {
  const normalized = { ...entry };

  if (normalized.id === 'cabinetThermistorOhms') {
    normalized.ranges = {
      normal: { min: 5000, max: 16000 },
      warning: { min: 3000, max: 20000 },
      critical: { below: 1000, above: 50000 },
    };
    normalized.typical = { min: 8000, max: 12000 };
    normalized.notes =
      'NTC thermistor at room temp — typically 5k–16k Ω. Verify against manufacturer chart when available.';
  }

  if (normalized.id === 'defrostHeaterOhms') {
    normalized.ranges = {
      normal: { min: 15, max: 75 },
      warning: { min: 10, max: 90 },
      critical: { below: 5, above: 120 },
    };
    normalized.typical = { min: 26, max: 63 };
    normalized.notes =
      'Varies by brand: Whirlpool WRT top-mount ~30 Ω installed / ~33 Ω uninstalled; many units ~26–32 Ω; Samsung SxS ~63 Ω ±7%; LG LRMVS3006 F defrost 62–70 Ω, R defrost 103–119 Ω (use brand-specific IDs when known).';
  }

  if (normalized.id === 'microwaveHVDiodeCheck') {
    normalized.inputKind = 'diodeCheck';
    normalized.ranges = undefined;
  }

  if (normalized.appliesTo?.equipmentSubtypes?.includes('ice_maker' as never)) {
    normalized.appliesTo = {
      ...normalized.appliesTo,
      equipmentSubtypes: [
        ...new Set(
          normalized.appliesTo.equipmentSubtypes
            .filter((s) => s !== 'ice_maker')
            .concat(['refrigerator', 'freezer']),
        ),
      ],
    };
  }

  return normalized;
}

const ALL_ENTRIES: MeasurementKnowledgeDefinition[] = [
  ...(batch1 as MeasurementKnowledgeDefinition[]),
  ...(batch2 as MeasurementKnowledgeDefinition[]),
  ...(batch3 as MeasurementKnowledgeDefinition[]),
  ...(batch4 as MeasurementKnowledgeDefinition[]),
  ...(batch5 as MeasurementKnowledgeDefinition[]),
  ...(batch6 as MeasurementKnowledgeDefinition[]),
  ...(batch7 as MeasurementKnowledgeDefinition[]),
  ...(batch8 as MeasurementKnowledgeDefinition[]),
  ...(batch9 as MeasurementKnowledgeDefinition[]),
  ...(batch10 as MeasurementKnowledgeDefinition[]),
  ...(batch11 as MeasurementKnowledgeDefinition[]),
  ...(batch12 as MeasurementKnowledgeDefinition[]),
  ...(batch13 as MeasurementKnowledgeDefinition[]),
  ...(batch14 as MeasurementKnowledgeDefinition[]),
  ...(batch15 as MeasurementKnowledgeDefinition[]),
].map(normalizeKnowledgeEntry);

const KNOWLEDGE_BY_ID = new Map<string, MeasurementKnowledgeDefinition>(
  ALL_ENTRIES.map((entry) => [entry.id, entry]),
);

export function getMeasurementKnowledge(id: string | null | undefined): MeasurementKnowledgeDefinition | null {
  if (!id) return null;
  return KNOWLEDGE_BY_ID.get(id) || null;
}

export function listMeasurementKnowledge(): MeasurementKnowledgeDefinition[] {
  return [...ALL_ENTRIES];
}

const ELIMINATION_BY_TEMPLATE = new Map<string, EliminationConfig>([
  [(refrigeratorElimination as EliminationConfig).templateId, refrigeratorElimination as EliminationConfig],
  [(dishwasherElimination as EliminationConfig).templateId, dishwasherElimination as EliminationConfig],
  [(gasRangeElimination as EliminationConfig).templateId, gasRangeElimination as EliminationConfig],
  [(electricDryerElimination as EliminationConfig).templateId, electricDryerElimination as EliminationConfig],
  [(gasDryerElimination as EliminationConfig).templateId, gasDryerElimination as EliminationConfig],
  [(electricRangeElimination as EliminationConfig).templateId, electricRangeElimination as EliminationConfig],
  [(washerElimination as EliminationConfig).templateId, washerElimination as EliminationConfig],
  [(microwaveElimination as EliminationConfig).templateId, microwaveElimination as EliminationConfig],
  [(standaloneFreezerElimination as EliminationConfig).templateId, standaloneFreezerElimination as EliminationConfig],
  [(stackedLaundryElimination as EliminationConfig).templateId, stackedLaundryElimination as EliminationConfig],
  [(aioLaundryElimination as EliminationConfig).templateId, aioLaundryElimination as EliminationConfig],
]);

export function getEliminationConfig(templateId: string | null | undefined): EliminationConfig | null {
  if (!templateId) return null;
  return ELIMINATION_BY_TEMPLATE.get(templateId) || null;
}
