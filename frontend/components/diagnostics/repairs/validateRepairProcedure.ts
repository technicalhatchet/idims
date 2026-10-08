import type { RepairProcedure, RepairProcedureCheck, RepairProcedureStep } from './types';

const FORBIDDEN_INVENTION_PATTERNS = [
  /\btorque\b/i,
  /\b\d+\s*ft-?lb/i,
  /\b\d+\s*nm\b/i,
  /\b\d+\s*screws?\b/i,
];

function assertSourceProvenance(
  label: string,
  source: { manualId?: string; sourceExcerpt?: string; pages?: number[] },
): string[] {
  const errors: string[] = [];
  if (!source.manualId?.trim()) {
    errors.push(`${label}: missing manualId`);
  }
  if (!source.sourceExcerpt?.trim()) {
    errors.push(`${label}: missing sourceExcerpt`);
  }
  if (!source.pages?.length) {
    errors.push(`${label}: missing pages`);
  }
  for (const pattern of FORBIDDEN_INVENTION_PATTERNS) {
    if (source.sourceExcerpt && pattern.test(source.sourceExcerpt)) {
      errors.push(`${label}: unsupported detail in sourceExcerpt (${pattern})`);
    }
  }
  return errors;
}

function validateOrderedChecks(name: string, checks: RepairProcedureCheck[]): string[] {
  const errors: string[] = [];
  const orders = checks.map((c) => c.order);
  const sorted = [...orders].sort((a, b) => a - b);
  if (orders.join(',') !== sorted.join(',')) {
    errors.push(`${name}: orders must be ascending`);
  }
  if (new Set(orders).size !== orders.length) {
    errors.push(`${name}: duplicate order values`);
  }
  for (const check of checks) {
    errors.push(...assertSourceProvenance(`${name}.${check.id}`, check.source));
  }
  return errors;
}

function validateSteps(steps: RepairProcedureStep[]): string[] {
  const errors: string[] = [];
  const orders = steps.map((s) => s.order);
  const sorted = [...orders].sort((a, b) => a - b);
  if (orders.join(',') !== sorted.join(',')) {
    errors.push('steps: orders must be ascending');
  }
  for (const step of steps) {
    errors.push(...assertSourceProvenance(`step.${step.id}`, step.source));
    if (step.toolRefs?.length) {
      for (const ref of step.toolRefs) {
        if (!/^[a-z0-9_]+$/.test(ref)) {
          errors.push(`step.${step.id}: invalid toolRef ${ref}`);
        }
      }
    }
  }
  return errors;
}

export function validateRepairProcedure(procedure: RepairProcedure): string[] {
  const errors: string[] = [];
  errors.push(...assertSourceProvenance('procedure.source', procedure.source));
  errors.push(...validateOrderedChecks('safety', procedure.safety));
  errors.push(...validateOrderedChecks('beforeRepairChecks', procedure.beforeRepairChecks));
  errors.push(...validateSteps(procedure.steps));
  errors.push(...validateOrderedChecks('finalChecks', procedure.finalChecks));

  for (const tool of procedure.tools) {
    errors.push(...assertSourceProvenance(`tool.${tool.id}`, tool.source));
  }
  for (const part of procedure.parts) {
    errors.push(...assertSourceProvenance(`part.${part.id}`, part.source));
  }

  return errors;
}
