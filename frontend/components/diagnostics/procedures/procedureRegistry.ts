import w11169652ServiceMode from './seed/whirlpool_fl_dd/bundles/w11169652-service-mode.json';
import w11169652Test03MotorSeed from './seed/whirlpool_fl_dd/w11169652-test-03-motor.json';
import w11169652Test08DrainPumpSeed from './seed/whirlpool_fl_dd/w11169652-test-08-drain-pump.json';
import w11169652Test04DoorLockSeed from './seed/whirlpool_fl_dd/w11169652-test-04-door-lock.json';
import w11169652Test09WashHeaterSeed from './seed/whirlpool_fl_dd/w11169652-test-09-wash-heater.json';
import { resolveServiceProcedureSeed } from './resolveServiceModeBundle';
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

const SERVICE_MODE_BUNDLES: ServiceModeBundle[] = [
  w11169652ServiceMode as ServiceModeBundle,
];

const BUNDLE_BY_ID = new Map(SERVICE_MODE_BUNDLES.map((bundle) => [bundle.id, bundle]));

const PROCEDURE_SEEDS: ServiceProcedureSeed[] = [
  w11169652Test03MotorSeed as ServiceProcedureSeed,
  w11169652Test08DrainPumpSeed as ServiceProcedureSeed,
  w11169652Test04DoorLockSeed as ServiceProcedureSeed,
  w11169652Test09WashHeaterSeed as ServiceProcedureSeed,
];

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

export { w11169652Test03MotorSeed as w11169652Test03Motor, w11169652Test08DrainPumpSeed as w11169652Test08DrainPump, w11169652Test04DoorLockSeed as w11169652Test04DoorLock, w11169652Test09WashHeaterSeed as w11169652Test09WashHeater, w11169652ServiceMode };
