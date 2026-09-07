import w11169652Test03Motor from './seed/whirlpool_fl_dd/w11169652-test-03-motor.json';
import type { ServiceProcedure } from './types';

const ALL_PROCEDURES: ServiceProcedure[] = [w11169652Test03Motor as ServiceProcedure];

const PROCEDURE_BY_ID = new Map(ALL_PROCEDURES.map((procedure) => [procedure.id, procedure]));

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

export { w11169652Test03Motor };
