import w11169652ServiceMode from './seed/whirlpool_fl_dd/bundles/w11169652-service-mode.json';
import w11169652Test01AcuPowerSeed from './seed/whirlpool_fl_dd/w11169652-test-01-acu-power.json';
import w11169652Test02HmiSeed from './seed/whirlpool_fl_dd/w11169652-test-02-hmi.json';
import w11169652Test03MotorSeed from './seed/whirlpool_fl_dd/w11169652-test-03-motor.json';
import w11169652Test04DoorLockSeed from './seed/whirlpool_fl_dd/w11169652-test-04-door-lock.json';
import w11169652Test05DrumLightSeed from './seed/whirlpool_fl_dd/w11169652-test-05-drum-light.json';
import w11169652Test06InletValvesSeed from './seed/whirlpool_fl_dd/w11169652-test-06-inlet-valves.json';
import w11169652Test07WaterLevelSeed from './seed/whirlpool_fl_dd/w11169652-test-07-water-level-sensor.json';
import w11169652Test08DrainPumpSeed from './seed/whirlpool_fl_dd/w11169652-test-08-drain-pump.json';
import w11169652Test09WashHeaterSeed from './seed/whirlpool_fl_dd/w11169652-test-09-wash-heater.json';
import w11169652Test10WashTempSensorSeed from './seed/whirlpool_fl_dd/w11169652-test-10-wash-temp-sensor.json';
import w11169652Test11aSingleDoseSeed from './seed/whirlpool_fl_dd/w11169652-test-11a-single-dose-dispenser.json';
import w11169652Test11bDosingPumpSeed from './seed/whirlpool_fl_dd/w11169652-test-11b-dosing-pump.json';
import w11169652Test12aBulkDispenserSeed from './seed/whirlpool_fl_dd/w11169652-test-12a-bulk-dispenser.json';
import w11169652Test12bBulkLevelSeed from './seed/whirlpool_fl_dd/w11169652-test-12b-bulk-level-sensing.json';
import w11169652Test13VentFanSeed from './seed/whirlpool_fl_dd/w11169652-test-13-vent-fan.json';
import w11169652Test14VentBaffleSeed from './seed/whirlpool_fl_dd/w11169652-test-14-vent-baffle.json';
import w11169652Test15DryHeaterSeed from './seed/whirlpool_fl_dd/w11169652-test-15-dry-heater.json';
import w11169652Test16DryTempSensorSeed from './seed/whirlpool_fl_dd/w11169652-test-16-dry-temp-sensor.json';
import w11169652Test17DryBlowerSeed from './seed/whirlpool_fl_dd/w11169652-test-17-dry-blower.json';
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
  w11169652Test01AcuPowerSeed as ServiceProcedureSeed,
  w11169652Test02HmiSeed as ServiceProcedureSeed,
  w11169652Test03MotorSeed as ServiceProcedureSeed,
  w11169652Test04DoorLockSeed as ServiceProcedureSeed,
  w11169652Test05DrumLightSeed as ServiceProcedureSeed,
  w11169652Test06InletValvesSeed as ServiceProcedureSeed,
  w11169652Test07WaterLevelSeed as ServiceProcedureSeed,
  w11169652Test08DrainPumpSeed as ServiceProcedureSeed,
  w11169652Test09WashHeaterSeed as ServiceProcedureSeed,
  w11169652Test10WashTempSensorSeed as ServiceProcedureSeed,
  w11169652Test11aSingleDoseSeed as ServiceProcedureSeed,
  w11169652Test11bDosingPumpSeed as ServiceProcedureSeed,
  w11169652Test12aBulkDispenserSeed as ServiceProcedureSeed,
  w11169652Test12bBulkLevelSeed as ServiceProcedureSeed,
  w11169652Test13VentFanSeed as ServiceProcedureSeed,
  w11169652Test14VentBaffleSeed as ServiceProcedureSeed,
  w11169652Test15DryHeaterSeed as ServiceProcedureSeed,
  w11169652Test16DryTempSensorSeed as ServiceProcedureSeed,
  w11169652Test17DryBlowerSeed as ServiceProcedureSeed,
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

export {
  w11169652ServiceMode,
  w11169652Test01AcuPowerSeed as w11169652Test01AcuPower,
  w11169652Test02HmiSeed as w11169652Test02Hmi,
  w11169652Test03MotorSeed as w11169652Test03Motor,
  w11169652Test04DoorLockSeed as w11169652Test04DoorLock,
  w11169652Test05DrumLightSeed as w11169652Test05DrumLight,
  w11169652Test06InletValvesSeed as w11169652Test06InletValves,
  w11169652Test07WaterLevelSeed as w11169652Test07WaterLevel,
  w11169652Test08DrainPumpSeed as w11169652Test08DrainPump,
  w11169652Test09WashHeaterSeed as w11169652Test09WashHeater,
  w11169652Test10WashTempSensorSeed as w11169652Test10WashTempSensor,
  w11169652Test11aSingleDoseSeed as w11169652Test11aSingleDose,
  w11169652Test11bDosingPumpSeed as w11169652Test11bDosingPump,
  w11169652Test12aBulkDispenserSeed as w11169652Test12aBulkDispenser,
  w11169652Test12bBulkLevelSeed as w11169652Test12bBulkLevel,
  w11169652Test13VentFanSeed as w11169652Test13VentFan,
  w11169652Test14VentBaffleSeed as w11169652Test14VentBaffle,
  w11169652Test15DryHeaterSeed as w11169652Test15DryHeater,
  w11169652Test16DryTempSensorSeed as w11169652Test16DryTempSensor,
  w11169652Test17DryBlowerSeed as w11169652Test17DryBlower,
};
