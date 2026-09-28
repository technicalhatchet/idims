import type { RepairProcedure } from './types';
import w8178558RepairDrainPump from './seed/w8178558-repair-drain-pump.json';

const REPAIR_PROCEDURES: RepairProcedure[] = [
  w8178558RepairDrainPump as RepairProcedure,
];

const BY_ID = new Map(REPAIR_PROCEDURES.map((item) => [item.id, item]));

export function getRepairProcedure(id: string | null | undefined): RepairProcedure | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function listRepairProcedures(): RepairProcedure[] {
  return [...REPAIR_PROCEDURES];
}
