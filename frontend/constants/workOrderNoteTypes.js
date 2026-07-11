import { REPAIR_OUTCOME_NOTE_TYPE } from './dmaCodes';

export const DIAGNOSTIC_RESULTS_NOTE_TYPE = 'Diagnostic Results';

export const NOTE_TYPES = {
  GENERAL: 'General Note',
  PRE_CALL: 'Pre-Call',
  FOLLOW_UP: 'Follow Up',
  REDO: 'Redo',
  REPAIR_OUTCOME: REPAIR_OUTCOME_NOTE_TYPE,
  DIAGNOSTIC_RESULTS: DIAGNOSTIC_RESULTS_NOTE_TYPE,
  STATUS_UPDATE: 'Status Update',
  APPOINTMENT_INFO: 'Appointment Info',
};

/** Types users pick manually (excludes system-generated). */
export const MANUAL_NOTE_TYPES = [
  NOTE_TYPES.GENERAL,
  NOTE_TYPES.PRE_CALL,
  NOTE_TYPES.FOLLOW_UP,
  NOTE_TYPES.REDO,
  NOTE_TYPES.REPAIR_OUTCOME,
  NOTE_TYPES.DIAGNOSTIC_RESULTS,
];

export const NOTE_TYPE_DESCRIPTIONS = {
  [NOTE_TYPES.GENERAL]: 'Free-form note for anything not covered below',
  [NOTE_TYPES.PRE_CALL]: 'Pre-visit checklist before heading out',
  [NOTE_TYPES.FOLLOW_UP]: 'What was done, parts used, and next steps',
  [NOTE_TYPES.REDO]: 'Callback context and revised plan',
  [NOTE_TYPES.REPAIR_OUTCOME]: 'Structured repair capture for Repair Memory (private)',
  [NOTE_TYPES.DIAGNOSTIC_RESULTS]: 'Structured appliance diagnostic checklist (private)',
};
