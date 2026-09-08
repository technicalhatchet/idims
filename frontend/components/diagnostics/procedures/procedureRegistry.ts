import { resolveServiceProcedureSeed } from './resolveServiceModeBundle';
import {
  GENERATED_PROCEDURE_SEEDS,
  GENERATED_SERVICE_MODE_BUNDLES,
} from './procedureRegistry.generated';
import {
  findServiceModeBundle,
  listServiceModeBundles,
  normalizeServiceModeRefs,
  type ServiceModeLookupOptions,
} from './serviceModeCatalog';
import type {
  ServiceModeBundle,
  ServiceModeKind,
  ServiceProcedure,
  ServiceProcedureSeed,
} from './types';

// Re-export lookup options type from catalog consumers
export type { ServiceModeLookupOptions } from './serviceModeCatalog';

const SERVICE_MODE_BUNDLES: ServiceModeBundle[] = [...GENERATED_SERVICE_MODE_BUNDLES];

const BUNDLE_BY_ID = new Map(SERVICE_MODE_BUNDLES.map((bundle) => [bundle.id, bundle]));

const PROCEDURE_SEEDS: ServiceProcedureSeed[] = [...GENERATED_PROCEDURE_SEEDS];

const ALL_PROCEDURES: ServiceProcedure[] = PROCEDURE_SEEDS.map((seed) =>
  resolveServiceProcedureSeed(seed, BUNDLE_BY_ID),
);

const PROCEDURE_BY_ID = new Map(ALL_PROCEDURES.map((procedure) => [procedure.id, procedure]));

export function getAllServiceModeBundles(): ServiceModeBundle[] {
  return SERVICE_MODE_BUNDLES;
}

export function getServiceModeBundle(id: string | null | undefined): ServiceModeBundle | null {
  if (!id) return null;
  return BUNDLE_BY_ID.get(id) ?? null;
}

export function getServiceModeBundlesForPlatform(
  platformId: string,
  options: ServiceModeLookupOptions = {},
): ServiceModeBundle[] {
  return listServiceModeBundles(SERVICE_MODE_BUNDLES, platformId, options);
}

export function getProcedureServiceModeRefs(
  procedureId: string | null | undefined,
): ReturnType<typeof normalizeServiceModeRefs> {
  if (!procedureId) return [];
  const seed = PROCEDURE_SEEDS.find((item) => item.id === procedureId);
  return seed ? normalizeServiceModeRefs(seed) : [];
}

export function getProcedureServiceModeKinds(
  procedureId: string | null | undefined,
): ServiceModeKind[] {
  const refs = getProcedureServiceModeRefs(procedureId);
  return refs.map((ref) => {
    const bundle = findServiceModeBundle(SERVICE_MODE_BUNDLES, ref.bundleId);
    return bundle?.modeKind ?? ref.modeKind;
  });
}

export function getAllServiceProcedures(): ServiceProcedure[] {
  return ALL_PROCEDURES;
}

export function getServiceProcedure(id: string | null | undefined): ServiceProcedure | null {
  if (!id) return null;
  return PROCEDURE_BY_ID.get(id) ?? null;
}

export function getServiceProceduresForPlatform(platformId: string): ServiceProcedure[] {
  return ALL_PROCEDURES.filter((procedure) => procedure.platformId === platformId);
}

export { GENERATED_PROCEDURE_SEEDS, GENERATED_SERVICE_MODE_BUNDLES };
