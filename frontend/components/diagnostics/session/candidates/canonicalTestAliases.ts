/**
 * Maps abstract canonical / scenario test ids to concrete candidate targets.
 * Used when decision branches reference nextTestCandidates or deprioritize by test id.
 */
export interface CanonicalTestAlias {
  testId: string;
  label: string;
  procedureIds?: string[];
  wizardStepKeys?: string[];
  componentIds?: string[];
  failureDomainIds?: string[];
}

export const CANONICAL_TEST_ALIASES: CanonicalTestAlias[] = [
  {
    testId: 'door_lock_test',
    label: 'Door lock investigation',
    procedureIds: ['w8178558-door-lock'],
    wizardStepKeys: ['mechanical'],
    componentIds: ['door_lock'],
    failureDomainIds: ['door_interlock_failure'],
  },
  {
    testId: 'drain_test',
    label: 'Drain investigation',
    procedureIds: ['w8178558-drain-pump'],
    wizardStepKeys: ['electrical'],
    componentIds: ['drain_pump'],
    failureDomainIds: ['drain_failure'],
  },
  {
    testId: 'motor_command_test',
    label: 'Motor command / control path',
    wizardStepKeys: ['electrical', 'diagnosis'],
    componentIds: ['motor_controller', 'control_board'],
    failureDomainIds: ['control_failure', 'communication_failure'],
  },
  {
    testId: 'motor_output_test',
    label: 'Motor output / drive path',
    procedureIds: ['w8178558-motor-circuit'],
    wizardStepKeys: ['electrical'],
    componentIds: ['drive_motor', 'motor_controller'],
    failureDomainIds: ['drive_failure'],
  },
  {
    testId: 'motor_winding_test',
    label: 'Motor winding measurement',
    procedureIds: ['w8178558-motor-circuit'],
    componentIds: ['drive_motor'],
    failureDomainIds: ['drive_failure'],
  },
  {
    testId: 'mechanical_path_test',
    label: 'Mechanical drive path',
    wizardStepKeys: ['mechanical'],
    componentIds: ['drive_belt', 'drum_bearing', 'suspension'],
    failureDomainIds: ['mechanical_failure'],
  },
  {
    testId: 'wiring_connection_test',
    label: 'Wiring / connector investigation',
    wizardStepKeys: ['electrical'],
    procedureIds: ['w8178558-motor-circuit'],
    componentIds: ['wiring_harness', 'motor_controller'],
    failureDomainIds: ['drive_failure', 'control_failure'],
  },
  {
    testId: 'control_output_test',
    label: 'Control output path',
    wizardStepKeys: ['electrical', 'diagnosis'],
    componentIds: ['motor_controller', 'control_board'],
    failureDomainIds: ['control_failure'],
  },
  {
    testId: 'control_board_test',
    label: 'Main control condemnation',
    componentIds: ['control_board', 'main_control'],
    failureDomainIds: ['control_failure'],
  },
  {
    testId: 'door_switch_test',
    label: 'Door switch / authorization',
    procedureIds: ['w8178559-door-switch'],
    wizardStepKeys: ['functional'],
    componentIds: ['door_switch'],
    failureDomainIds: ['door_authorization_failure'],
  },
  {
    testId: 'motor_run_test',
    label: 'Motor run verification',
    procedureIds: ['w8178559-motor-circuit'],
    wizardStepKeys: ['functional'],
    componentIds: ['drive_motor'],
    failureDomainIds: ['drive_failure'],
  },
  {
    testId: 'blower_run_test',
    label: 'Blower run verification',
    wizardStepKeys: ['functional'],
    componentIds: ['blower'],
    failureDomainIds: ['blower_failure'],
  },
  {
    testId: 'lint_filter_test',
    label: 'Lint filter / screen path',
    wizardStepKeys: ['commonly_missed', 'visual'],
    componentIds: ['lint_filter'],
    failureDomainIds: ['lint_filter_failure'],
  },
  {
    testId: 'exhaust_path_test',
    label: 'External exhaust vent path',
    wizardStepKeys: ['commonly_missed', 'visual'],
    componentIds: ['exhaust_path'],
    failureDomainIds: ['exhaust_path_failure', 'installation_external'],
  },
  {
    testId: 'heat_command_test',
    label: 'Heat source command / control output',
    wizardStepKeys: ['heat', 'electrical'],
    componentIds: ['control_board', 'heat_source'],
    failureDomainIds: ['control_failure', 'heating_failure'],
  },
  {
    testId: 'heat_output_test',
    label: 'Heat output / element or flame path',
    procedureIds: ['w8178559-heater-electric', 'w8178559-heater-gas', 'w8178559-gas-ignitor', 'w8178559-gas-valve'],
    wizardStepKeys: ['heat'],
    componentIds: ['heat_source', 'electric_heater'],
    failureDomainIds: ['heating_failure'],
  },
  {
    testId: 'thermal_protection_test',
    label: 'Thermal fuse / cutoff continuity',
    procedureIds: ['w8178559-thermal-fuse', 'w8178559-thermal-cutoff'],
    componentIds: ['thermal_fuse', 'thermal_cutoff'],
    failureDomainIds: ['heating_failure'],
  },
  {
    testId: 'exhaust_temperature_test',
    label: 'Exhaust temperature response',
    procedureIds: ['w8178559-exhaust-thermistor'],
    componentIds: ['temperature_sensor'],
    failureDomainIds: ['temperature_sensing_failure', 'heating_failure'],
  },
  {
    testId: 'moisture_sensor_test',
    label: 'Moisture sensor response',
    procedureIds: ['w8178559-moisture-sensor', 'w8178559-dryness-adjust'],
    componentIds: ['moisture_sensor'],
    failureDomainIds: ['moisture_sensing_failure'],
  },
];

const ALIAS_BY_TEST_ID = new Map(
  CANONICAL_TEST_ALIASES.map((alias) => [alias.testId, alias]),
);

export function getCanonicalTestAlias(testId: string): CanonicalTestAlias | null {
  return ALIAS_BY_TEST_ID.get(testId) ?? null;
}
