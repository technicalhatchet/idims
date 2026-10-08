/** Physical repair procedure — separate from diagnostic ServiceProcedure. */

export interface RepairProcedureSourceRef {
  manualId: string;
  manualTitle?: string;
  sectionTitle?: string;
  /** Verbatim or lightly normalized excerpt from extracted manual text. */
  sourceExcerpt: string;
  /** PDF page markers in extracted text file (dev traceability). */
  pages: number[];
  extractedTextFile?: string;
}

export interface RepairProcedureApplicability {
  platformId: string;
  manualId: string;
  modelPatterns: string[];
  smokeModel?: string;
}

export interface RepairProcedureTarget {
  componentId: string;
  label: string;
  diagnosticProcedureIds: string[];
}

export interface RepairProcedureToolRef {
  id: string;
  label: string;
  source: RepairProcedureSourceRef;
}

export interface RepairProcedurePartRef {
  id: string;
  label: string;
  source: RepairProcedureSourceRef;
}

export interface RepairProcedureCheck {
  id: string;
  order: number;
  instruction: string;
  source: RepairProcedureSourceRef;
  safetyWarning?: string;
}

export interface RepairProcedureStep {
  id: string;
  order: number;
  instruction: string;
  source: RepairProcedureSourceRef;
  safetyWarning?: string;
  expectedResult?: string;
  toolRefs?: string[];
  partRefs?: string[];
}

export interface RepairProcedure {
  id: string;
  version: string;
  title: string;
  applicability: RepairProcedureApplicability;
  repairTarget: RepairProcedureTarget;
  source: RepairProcedureSourceRef;
  safety: RepairProcedureCheck[];
  tools: RepairProcedureToolRef[];
  parts: RepairProcedurePartRef[];
  beforeRepairChecks: RepairProcedureCheck[];
  steps: RepairProcedureStep[];
  finalChecks: RepairProcedureCheck[];
}
