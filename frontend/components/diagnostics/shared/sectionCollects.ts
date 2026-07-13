/** Default `collects` tags by section id — used when a wizard step does not override. */
export const SECTION_COLLECTS_PRESETS: Record<string, string[]> = {
  commonly_missed: ['checklist', 'visual', 'installation'],
  customer_complaint: ['complaint', 'symptoms', 'error_codes'],
  temperature_checks: ['temperature', 'ambient'],
  visual_inspection: ['visual', 'gasket', 'cabinet', 'doors'],
  functional_checks: ['functional', 'operation'],
  compressor_sealed_system: ['amps', 'voltage', 'resistance', 'compressor', 'refrigerant'],
  defrost_circuit: ['defrost', 'resistance', 'thermistor'],
  fans_and_electrical: ['fans', 'amps', 'voltage', 'thermistor', 'electrical'],
  electrical_measurements: ['amps', 'voltage', 'resistance', 'electrical'],
  mechanical_controls: ['mechanical', 'actuator', 'pressure'],
  heat_circuit: ['heat', 'resistance', 'temperature', 'electrical'],
  gas_ignition: ['gas', 'igniter', 'flame', 'valve'],
  motor_electrical: ['motor', 'amps', 'resistance'],
  washer_section: ['washer', 'visual', 'leak'],
  dryer_section: ['dryer', 'visual', 'vent'],
  washer_measurements: ['washer', 'amps', 'valves', 'motor'],
  dryer_measurements: ['dryer', 'heat', 'vent', 'motor'],
  wash_functions: ['washer', 'functional'],
  dry_functions: ['dryer', 'functional'],
  wash_electrical: ['washer', 'electrical', 'motor'],
  heat_pump_readings: ['heat_pump', 'compressor', 'refrigerant', 'amps'],
  heat_water: ['heat', 'water', 'amps'],
  terminal_block_readings: ['voltage', 'electrical', 'terminal'],
  element_sensor_readings: ['element', 'resistance', 'sensor', 'temperature'],
  board_readings: ['board', 'voltage', 'electrical'],
  electrical_at_board: ['board', 'voltage', 'electrical'],
  gas_flame_readings: ['gas', 'flame', 'igniter', 'valve'],
  door_safety: ['door', 'safety', 'switches'],
  electrical_hv: ['hv', 'magnetron', 'capacitor', 'diode'],
  diagnosis: ['diagnosis', 'root_cause', 'repair_plan'],
};

export const DEFAULT_STEP_WEIGHT = 10;

export function collectsForSection(sectionId: string): string[] {
  return SECTION_COLLECTS_PRESETS[sectionId] || [sectionId.replace(/_/g, '-')];
}
