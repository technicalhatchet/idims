import w11169652ServiceMode from './seed/whirlpool_fl_dd/bundles/w11169652-service-mode.json';
import w11169652Test03MotorSeed from './seed/whirlpool_fl_dd/w11169652-test-03-motor.json';
import { resolveServiceProcedureSeed } from './resolveServiceModeBundle';
import type { ServiceModeBundle, ServiceProcedure, ServiceProcedureSeed } from './types';

const SERVICE_MODE_BUNDLES: ServiceModeBundle[] = [
  w11169652ServiceMode as ServiceModeBundle,
];

const BUNDLE_BY_ID = new Map(SERVICE_MODE_BUNDLES.map((bundle) => [bundle.id, bundle]));

const PROCEDURE_SEEDS: ServiceProcedureSeed[] = [
  w11169652Test03MotorSeed as ServiceProcedureSeed,
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

export { w11169652Test03MotorSeed as w11169652Test03Motor, w11169652ServiceMode };
