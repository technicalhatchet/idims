/** IDIMS diagnostic templates v1 — source: diagtemplates.pdf + field-service additions */

import { format } from 'date-fns';
import {
  COMPLAINT_TAGS_FIELD,
  inferComplaintChipIds,
} from '../components/diagnostics/routing/routingEngine';
import { REFRIGERATOR_COMPLAINT_CHIPS } from '../components/diagnostics/refrigerator/refrigeratorComplaints';
import { ELECTRIC_RANGE_COMPLAINT_CHIPS } from '../components/diagnostics/electric_range/electricRangeComplaints';
import { ELECTRIC_DRYER_COMPLAINT_CHIPS } from '../components/diagnostics/electric_dryer/electricDryerComplaints';
import { GAS_RANGE_COMPLAINT_CHIPS } from '../components/diagnostics/gas_range/gasRangeComplaints';
import { GAS_DRYER_COMPLAINT_CHIPS } from '../components/diagnostics/gas_dryer/gasDryerComplaints';
import { MICROWAVE_COMPLAINT_CHIPS } from '../components/diagnostics/microwave/microwaveComplaints';
import { DISHWASHER_COMPLAINT_CHIPS } from '../components/diagnostics/dishwasher/dishwasherComplaints';
import { WASHER_COMPLAINT_CHIPS } from '../components/diagnostics/washer/washerComplaints';
import { STACKED_LAUNDRY_COMPLAINT_CHIPS } from '../components/diagnostics/stacked_laundry/stackedLaundryComplaints';
import { AIO_LAUNDRY_COMPLAINT_CHIPS } from '../components/diagnostics/aio_laundry/aioLaundryComplaints';
import { STANDALONE_FREEZER_COMPLAINT_CHIPS } from '../components/diagnostics/standalone_freezer/standaloneFreezerComplaints';

const COMPLAINT_CHIPS_BY_TEMPLATE = {
  refrigerator: REFRIGERATOR_COMPLAINT_CHIPS,
  electric_range: ELECTRIC_RANGE_COMPLAINT_CHIPS,
  gas_range: GAS_RANGE_COMPLAINT_CHIPS,
  electric_dryer: ELECTRIC_DRYER_COMPLAINT_CHIPS,
  gas_dryer: GAS_DRYER_COMPLAINT_CHIPS,
  washer: WASHER_COMPLAINT_CHIPS,
  dishwasher: DISHWASHER_COMPLAINT_CHIPS,
  microwave: MICROWAVE_COMPLAINT_CHIPS,
  stacked_laundry: STACKED_LAUNDRY_COMPLAINT_CHIPS,
  aio_laundry: AIO_LAUNDRY_COMPLAINT_CHIPS,
  standalone_freezer: STANDALONE_FREEZER_COMPLAINT_CHIPS,
};

function applyComplaintChipInference(templateId, fields, text) {
  const chips = COMPLAINT_CHIPS_BY_TEMPLATE[templateId];
  if (!chips?.length || !text) return;
  const existing = fields[COMPLAINT_TAGS_FIELD];
  if (Array.isArray(existing) && existing.length) return;
  const inferred = inferComplaintChipIds(text, chips);
  if (inferred.length) fields[COMPLAINT_TAGS_FIELD] = inferred;
}

const tri = (id, label) => ({ id, label, type: 'tri' });
const yn = (id, label) => ({ id, label, type: 'yn' });
const gb = (id, label) => ({ id, label, type: 'gb' });
const txt = (id, label) => ({ id, label, type: 'text' });
const area = (id, label) => ({ id, label, type: 'textarea' });
const chk = (id, label) => ({ id, label, type: 'check' });

function missed(fields) {
  return { id: 'commonly_missed', title: 'Pre-Checks', fields };
}

function complaint(extra = []) {
  return {
    id: 'customer_complaint',
    title: 'Client Complaint',
    fields: [txt('complaint', 'Complaint'), ...extra],
  };
}

function diagnosis(extra = []) {
  return {
    id: 'diagnosis',
    title: 'Diagnosis',
    fields: [
      area('root_cause', 'Root Cause'),
      area('recommended_repair', 'Recommended Repair'),
      ...extra,
    ],
  };
}

export const DIAGNOSTIC_TEMPLATES = [
  {
    id: 'refrigerator',
    label: 'Refrigerator',
    equipmentKeys: ['refrigerator'],
    sections: [
      missed([
        chk('door_alignment', 'Door alignment / closing'),
        chk('gasket_sealing', 'Gasket sealing all doors'),
        chk('cabinet_damage', 'Cabinet / hinge damage'),
        chk('condenser_cleanliness', 'Condenser coil cleanliness'),
        chk('airflow_obstruction', 'Condenser / toe-kick airflow clear'),
        chk('leveling', 'Unit level / door swing'),
        chk('ice_maker_fill_tube', 'Ice maker fill tube / filter'),
      ]),
      complaint([
        txt('duration', 'Duration'),
        txt('intermittent_or_constant', 'Intermittent or Constant'),
        txt('error_codes', 'Display / Error Codes'),
      ]),
      {
        id: 'temperature_checks',
        title: 'Temperature Checks',
        fields: [
          txt('fresh_food_temp', 'Fresh food compartment (°F)'),
          txt('freezer_temp', 'Freezer compartment (°F)'),
          txt('ambient_room_temp', 'Ambient room temp (°F)'),
          txt('evap_air_temp', 'Evaporator outlet air (°F, if accessible)'),
        ],
      },
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          tri('door_alignment', 'Door Alignment'),
          tri('gasket_condition', 'Gasket Condition'),
          tri('cabinet_condition', 'Cabinet Condition'),
          tri('condenser_condition', 'Condenser Condition'),
          yn('frost_present', 'Heavy Frost / Ice Buildup Present'),
          tri('evaporator_frost_pattern', 'Evaporator Frost Pattern'),
          tri('ice_maker_visual', 'Ice Maker / Dispenser (if equipped)'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          yn('compressor_running', 'Compressor Running'),
          yn('condenser_fan_running', 'Condenser Fan Running'),
          yn('evaporator_fan_running', 'Evaporator Fan Running'),
          gb('damper_operation', 'Fresh Food Damper / Air Tower'),
          yn('defrost_cycle_observed', 'Defrost Cycle Heard / Observed'),
          gb('ice_maker_operation', 'Ice Maker Operation (if equipped)'),
          gb('water_dispenser', 'Water Dispenser (if equipped)'),
        ],
      },
      {
        id: 'compressor_sealed_system',
        title: 'Compressor & Sealed System Readings',
        fields: [
          txt('compressor_amps_running', 'Compressor amps — running'),
          txt('compressor_amps_startup', 'Compressor amps — startup / LRA'),
          txt('run_winding_ohms', 'Compressor run winding (Ω)'),
          txt('start_winding_ohms', 'Compressor start winding (Ω)'),
          txt('common_to_run_ohms', 'Common to run (Ω)'),
          txt('common_to_start_ohms', 'Common to start (Ω)'),
          txt('compressor_voltage', 'Voltage at compressor / relay'),
          txt('start_relay_overload', 'Start relay / overload (part # or test)'),
          txt('start_capacitor_uf', 'Start capacitor (µF)'),
          txt('suction_line_feel', 'Suction line temp / frost pattern'),
          txt('discharge_line_feel', 'Discharge line temp / feel'),
          area('sealed_system_notes', 'Sealed system / leak / restriction notes'),
        ],
      },
      {
        id: 'defrost_circuit',
        title: 'Defrost Circuit Readings',
        fields: [
          txt('defrost_heater_ohms', 'Defrost heater resistance (Ω)'),
          txt('defrost_thermostat', 'Defrost thermostat / bi-metal'),
          txt('defrost_fuse', 'Defrost fuse / thermal fuse'),
          txt('defrost_thermistor', 'Defrost thermistor (Ω or °F)'),
        ],
      },
      {
        id: 'fans_and_electrical',
        title: 'Fans & Electrical Readings',
        fields: [
          txt('condenser_fan_amps', 'Condenser fan motor amps'),
          txt('evaporator_fan_amps', 'Evaporator fan motor amps'),
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('fresh_food_thermistor', 'Fresh food thermistor (Ω or °F)'),
          txt('freezer_thermistor', 'Freezer thermistor (Ω or °F)'),
          area('board_notes', 'Control board / sensor notes'),
        ],
      },
      diagnosis([area('additional_notes', 'Additional Notes')]),
    ],
  },
  {
    id: 'standalone_freezer',
    label: 'Standalone Freezer',
    equipmentKeys: ['freezer'],
    sections: [
      missed([
        chk('door_sealing', 'Door sealing'),
        chk('frost_source', 'Frost accumulation source'),
        chk('condenser_cleanliness', 'Condenser cleanliness'),
        chk('defrost_drain', 'Defrost drain / pan'),
        chk('leveling', 'Unit level'),
      ]),
      complaint([
        txt('duration', 'Duration'),
        txt('intermittent_or_constant', 'Intermittent or Constant'),
      ]),
      {
        id: 'temperature_checks',
        title: 'Temperature Checks',
        fields: [
          txt('freezer_temp', 'Cabinet temp (°F)'),
          txt('ambient_temp', 'Ambient temp (°F)'),
        ],
      },
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          tri('door_alignment', 'Door Alignment'),
          tri('gasket_condition', 'Gasket Condition'),
          gb('frost_pattern', 'Frost Pattern'),
          tri('condenser_condition', 'Condenser Condition'),
          yn('drain_clear', 'Drain Clear'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          yn('compressor_running', 'Compressor Running'),
          yn('condenser_fan_running', 'Condenser Fan Running'),
          yn('evaporator_fan_running', 'Evaporator Fan Running'),
          yn('defrost_operational', 'Defrost System Operational'),
        ],
      },
      {
        id: 'compressor_sealed_system',
        title: 'Compressor & Sealed System Readings',
        fields: [
          txt('compressor_amps_running', 'Compressor amps — running'),
          txt('compressor_amps_startup', 'Compressor amps — startup / LRA'),
          txt('run_winding_ohms', 'Compressor run winding (Ω)'),
          txt('start_winding_ohms', 'Compressor start winding (Ω)'),
          txt('compressor_voltage', 'Voltage at compressor / relay'),
          txt('suction_line_feel', 'Suction line temp / frost pattern'),
          txt('discharge_line_feel', 'Discharge line temp / feel'),
          area('sealed_system_notes', 'Sealed system notes'),
        ],
      },
      {
        id: 'defrost_circuit',
        title: 'Defrost Circuit Readings',
        fields: [
          txt('defrost_heater_ohms', 'Defrost heater resistance (Ω)'),
          txt('defrost_thermostat', 'Defrost thermostat / bi-metal'),
          txt('thermistor_reading', 'Cabinet thermistor (Ω or °F)'),
        ],
      },
      {
        id: 'fans_and_electrical',
        title: 'Fans & Electrical Readings',
        fields: [
          txt('condenser_fan_amps', 'Condenser fan amps'),
          txt('evaporator_fan_amps', 'Evaporator fan amps'),
          txt('supply_voltage', 'Supply voltage (V)'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'washer',
    label: 'Washer',
    equipmentKeys: ['washer', 'washing_machine'],
    sections: [
      missed([
        chk('suspension', 'Suspension / shocks'),
        chk('drain_restrictions', 'Drain / standpipe restrictions'),
        chk('loading_habits', 'Customer loading habits'),
        chk('water_pressure', 'House water pressure / supply'),
        chk('shipping_bolts', 'Shipping bolts removed (new install)'),
        chk('inlet_screens', 'Inlet hose screens clear'),
        chk('level', 'Unit level'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          gb('suspension', 'Suspension'),
          gb('tub_movement', 'Tub Movement'),
          gb('hoses_condition', 'Hoses / Connections'),
          yn('leak_present', 'Leak Present'),
          tri('drive_belt', 'Belt / Pulley (if accessible)'),
          tri('door_boot', 'Door boot / gasket (front load)'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          gb('fill_operation', 'Fill Operation (hot & cold)'),
          gb('agitation', 'Agitation'),
          gb('spin_operation', 'Spin Operation'),
          gb('drain_operation', 'Drain Operation'),
          gb('lid_lock_operation', 'Lid / Door Lock Operation'),
          gb('balance', 'Balance / Vibration on spin'),
        ],
      },
      {
        id: 'electrical_measurements',
        title: 'Electrical Measurements',
        fields: [
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('drive_motor_ohms', 'Drive / wash motor resistance (Ω)'),
          txt('drive_motor_amps', 'Drive motor amps (agitate / spin)'),
          txt('drain_pump_ohms', 'Drain pump resistance (Ω)'),
          txt('drain_pump_amps', 'Drain pump amps'),
          txt('inlet_valve_ohms', 'Inlet valve coil(s) (Ω)'),
          txt('water_pressure', 'Water pressure (PSI)'),
        ],
      },
      {
        id: 'mechanical_controls',
        title: 'Mechanical / Control Checks',
        fields: [
          gb('shift_actuator', 'Shift actuator / transmission'),
          gb('clutch', 'Clutch / splutch'),
          gb('pressure_switch', 'Pressure switch / hose'),
          txt('door_lock_ohms', 'Door lock / latch (Ω)'),
          area('board_notes', 'Control / MCU notes'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'electric_dryer',
    label: 'Electric Dryer',
    equipmentKeys: ['dryer'],
    sections: [
      missed([
        chk('vent_restriction', 'Vent restriction / length'),
        chk('crushed_vent', 'Crushed vent hose'),
        chk('poor_airflow', 'Poor airflow at exterior hood'),
        chk('overloading', 'Customer overloading'),
        chk('lint_trap', 'Lint screen / housing clean'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          gb('vent_condition', 'Vent / Duct Condition'),
          gb('lint_accumulation', 'Lint Accumulation'),
          gb('drum_condition', 'Drum / Rollers / Glides'),
          tri('element_coils', 'Heating element (visual)'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          yn('drum_turning', 'Drum Turning'),
          yn('heating', 'Heating'),
          gb('airflow', 'Airflow at vent'),
          gb('blower_operation', 'Blower Operation'),
          gb('moisture_sensor', 'Moisture sensor bars (if equipped)'),
        ],
      },
      {
        id: 'heat_circuit',
        title: 'Heat Circuit Readings',
        fields: [
          txt('heater_ohms', 'Heating element resistance (Ω)'),
          txt('heater_amps', 'Heating element amps (energized)'),
          txt('thermal_fuse', 'Thermal fuse / hi-limit continuity'),
          txt('cycling_thermostat', 'Cycling thermostat'),
          txt('high_limit', 'High-limit thermostat'),
          txt('exhaust_temp', 'Exhaust air temp at vent (°F)'),
        ],
      },
      {
        id: 'motor_electrical',
        title: 'Motor & Electrical Readings',
        fields: [
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('motor_ohms', 'Drive motor resistance (Ω)'),
          txt('motor_amps', 'Motor amps (running)'),
          txt('belt_idler', 'Belt / idler pulley condition'),
          area('board_notes', 'Control board / relay notes'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'gas_dryer',
    label: 'Gas Dryer',
    equipmentKeys: ['gas_dryer'],
    sections: [
      missed([
        chk('vent_restriction', 'Vent restriction / length'),
        chk('gas_supply', 'Gas supply valve on'),
        chk('lint_trap', 'Lint screen / housing clean'),
        chk('lp_orifices', 'LP conversion / orifices correct'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          gb('vent_condition', 'Vent / Duct Condition'),
          gb('lint_accumulation', 'Lint Accumulation'),
          tri('igniter_condition', 'Igniter condition'),
          tri('gas_valve', 'Gas valve / burner assembly'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          yn('drum_turning', 'Drum Turning'),
          yn('ignition', 'Burner Ignition'),
          gb('airflow', 'Airflow at vent'),
          gb('blower_operation', 'Blower Operation'),
          gb('flame_quality', 'Flame quality / stays lit'),
        ],
      },
      {
        id: 'gas_ignition',
        title: 'Gas & Ignition Readings',
        fields: [
          txt('igniter_amps', 'Igniter amps (glow)'),
          txt('igniter_ohms', 'Igniter resistance cold (Ω)'),
          txt('gas_valve_coils', 'Gas valve coil(s) (Ω)'),
          txt('flame_sensor', 'Flame sensor / radiant sensor'),
          txt('gas_pressure_note', 'Gas pressure / manifold (if measured)'),
        ],
      },
      {
        id: 'motor_electrical',
        title: 'Motor & Electrical Readings',
        fields: [
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('motor_ohms', 'Drive motor resistance (Ω)'),
          txt('thermal_fuse', 'Thermal fuse / hi-limit'),
          txt('exhaust_temp', 'Exhaust temp at vent (°F)'),
          area('board_notes', 'Control / radiant sensor notes'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'stacked_laundry',
    label: 'Laundry Center / Stacked Unit',
    equipmentKeys: ['stacked_laundry'],
    sections: [
      missed([
        chk('shared_power', 'Shared power / outlet load'),
        chk('airflow_restrictions', 'Dryer vent / airflow'),
        chk('installation', 'Installation / stacking kit / level'),
        chk('water_supply', 'Washer water supply / drain'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'washer_section',
        title: 'Washer Section',
        fields: [
          gb('fill', 'Fill'),
          gb('agitate', 'Agitate'),
          gb('drain', 'Drain'),
          gb('spin', 'Spin'),
          yn('washer_leak', 'Leak Present'),
        ],
      },
      {
        id: 'dryer_section',
        title: 'Dryer Section',
        fields: [
          yn('drum_turning', 'Drum Turning'),
          yn('heat_present', 'Heat Present'),
          gb('airflow', 'Airflow'),
          gb('blower', 'Blower Operation'),
        ],
      },
      {
        id: 'washer_measurements',
        title: 'Washer Electrical Readings',
        fields: [
          txt('washer_motor_ohms', 'Wash motor (Ω)'),
          txt('drain_pump_ohms', 'Drain pump (Ω)'),
          txt('water_pressure', 'Water pressure (PSI)'),
        ],
      },
      {
        id: 'dryer_measurements',
        title: 'Dryer Heat / Motor Readings',
        fields: [
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('heater_ohms', 'Heater / igniter (Ω)'),
          txt('heater_or_igniter_amps', 'Heater or igniter amps'),
          txt('motor_ohms', 'Dryer motor (Ω)'),
          txt('thermal_fuse', 'Thermal fuse / hi-limit'),
          txt('exhaust_temp', 'Exhaust temp at vent (°F)'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'aio_laundry',
    label: 'AIO Laundry (Heat-Pump Combo)',
    equipmentKeys: ['aio_laundry'],
    sections: [
      missed([
        chk('heat_pump_filter', 'Heat pump filter / condenser clean'),
        chk('vent_airflow', 'Exhaust / condenser airflow'),
        chk('water_pressure', 'Water pressure / inlet screens'),
        chk('level_install', 'Level / installation / pedestal'),
        chk('drain_filter', 'Drain pump filter / coin trap'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'wash_functions',
        title: 'Wash Functions',
        fields: [
          gb('fill', 'Fill'),
          gb('agitate', 'Agitate'),
          gb('spin', 'Spin'),
          gb('drain', 'Drain'),
          yn('washer_leak', 'Leak Present'),
        ],
      },
      {
        id: 'dry_functions',
        title: 'Dry / Heat-Pump Functions',
        fields: [
          yn('drum_turning', 'Drum Turning'),
          yn('heat_present', 'Heat / drying present'),
          gb('airflow', 'Airflow / condenser fan'),
          gb('condensate_drain', 'Condensate / drain pump'),
        ],
      },
      {
        id: 'wash_electrical',
        title: 'Wash Electrical Readings',
        fields: [
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('wash_motor_ohms', 'Wash motor (Ω)'),
          txt('drain_pump_ohms', 'Drain pump (Ω)'),
          txt('water_pressure', 'Water pressure (PSI)'),
        ],
      },
      {
        id: 'heat_pump_readings',
        title: 'Heat-Pump / Compressor Readings',
        fields: [
          txt('compressor_amps', 'Compressor amps (running)'),
          txt('compressor_ohms', 'Compressor windings (Ω)'),
          txt('heat_pump_fan_amps', 'Condenser / heat-pump fan amps'),
          txt('heater_amps', 'Supplemental heater amps (if equipped)'),
          area('refrigerant_notes', 'Refrigerant / sealed system notes'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'dishwasher',
    label: 'Dishwasher',
    equipmentKeys: ['dishwasher'],
    sections: [
      missed([
        chk('disposal_knockout', 'Garbage disposal knockout'),
        chk('drain_restrictions', 'Drain / air gap restrictions'),
        chk('detergent_usage', 'Customer detergent / rinse aid'),
        chk('water_temperature', 'Hot water at sink (120°F+)'),
        chk('inlet_screen', 'Inlet valve screen'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          yn('spray_arms_clear', 'Spray Arms Clear'),
          gb('filter_condition', 'Filter Condition'),
          yn('drain_path_clear', 'Drain Path Clear'),
          yn('leak_present', 'Leak Present'),
          tri('door_gasket', 'Door Gasket / Tub Seal'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          gb('fill_operation', 'Fill Operation'),
          gb('wash_operation', 'Wash Operation (circulation)'),
          gb('drain_operation', 'Drain Operation'),
          gb('drying_operation', 'Drying / Heat Operation'),
          gb('detergent_dispenser', 'Detergent / rinse dispenser'),
        ],
      },
      {
        id: 'heat_water',
        title: 'Heat & Water Readings',
        fields: [
          txt('incoming_water_temp', 'Incoming water temp (°F)'),
          txt('heater_ohms', 'Heater resistance (Ω)'),
          txt('heater_amps', 'Heater amps (energized)'),
          txt('thermistor', 'Thermistor / OWI (Ω)'),
        ],
      },
      {
        id: 'motor_electrical',
        title: 'Motor & Electrical Readings',
        fields: [
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('wash_motor_ohms', 'Wash / circulation motor (Ω)'),
          txt('drain_motor_ohms', 'Drain motor (Ω)'),
          txt('inlet_valve_ohms', 'Inlet valve coil(s) (Ω)'),
          txt('float_switch', 'Float switch / leak sensor'),
          area('board_notes', 'Control board / diverter notes'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'electric_range',
    label: 'Electric Range',
    equipmentKeys: ['electric_range', 'range', 'oven', 'wall_oven'],
    sections: [
      missed([
        chk('incoming_voltage', 'Incoming voltage verified'),
        chk('miswired_outlet', 'Miswired outlet / receptacle'),
        chk('terminal_burn', 'Burnt terminal block / loose lugs'),
        chk('calibration', 'Calibration / offset checked'),
        chk('cookware', 'Customer cookware concerns'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          tri('terminal_block', 'Terminal Block Condition'),
          tri('wiring_condition', 'Wiring / Harness Condition'),
          tri('door_seal', 'Door Seal Condition'),
          tri('bake_element_visible', 'Bake Element (visible damage)'),
          tri('broil_element_visible', 'Broil Element (visible damage)'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          gb('bake_operation', 'Bake Operation'),
          gb('broil_operation', 'Broil Operation'),
          gb('convection_operation', 'Convection Operation'),
          gb('surface_burners', 'Surface Burners (if equipped)'),
          gb('door_lock_operation', 'Door Lock / Self-Clean Lock'),
        ],
      },
      {
        id: 'terminal_block_readings',
        title: 'Terminal Block / Supply Readings',
        fields: [
          txt('l1_l2_voltage', 'L1–L2 at block (V)'),
          txt('l1_neutral_voltage', 'L1–Neutral (V)'),
          txt('l2_neutral_voltage', 'L2–Neutral (V)'),
          txt('neutral_ground_voltage', 'Neutral–Ground (V)'),
          txt('supply_notes', 'Supply / wiring notes'),
        ],
      },
      {
        id: 'element_sensor_readings',
        title: 'Element & Sensor Readings',
        fields: [
          txt('bake_element_ohms', 'Bake element resistance (Ω)'),
          txt('broil_element_ohms', 'Broil element resistance (Ω)'),
          txt('bake_element_amps', 'Bake element amps (energized)'),
          txt('broil_element_amps', 'Broil element amps (energized)'),
          txt('temp_sensor_ohms', 'Oven temp sensor (Ω at room)'),
        ],
      },
      {
        id: 'board_readings',
        title: 'Control Board Readings',
        fields: [
          txt('board_supply_voltage', 'Board supply voltage (V)'),
          txt('bake_relay_output', 'Bake relay output / bake leg (V when on)'),
          txt('broil_relay_output', 'Broil relay output / broil leg (V when on)'),
          txt('convection_output', 'Convection motor / relay (V or amps)'),
          txt('oven_temp_at_probe', 'Oven temp at center probe (°F)'),
          area('board_notes', 'Board test points / relay notes'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'gas_range',
    label: 'Gas Range',
    equipmentKeys: ['gas_range'],
    sections: [
      missed([
        chk('gas_supply', 'Gas supply valve on / line verified'),
        chk('anti_tip', 'Anti-tip bracket installed'),
        chk('lp_orifices', 'LP orifice / conversion correct'),
        chk('ventilation', 'Adequate ventilation / hood'),
        chk('gas_odor', 'Gas odor / leak check performed'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          tri('burner_condition', 'Oven burner / tube condition'),
          tri('igniter_condition', 'Oven igniter condition'),
          tri('gas_valve_condition', 'Gas valve / manifold condition'),
          tri('door_seal', 'Door Seal Condition'),
          tri('surface_burners_visual', 'Surface burner caps / ports'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          gb('oven_bake_ignition', 'Oven Bake Ignition'),
          gb('oven_broil_ignition', 'Oven Broil Ignition'),
          gb('surface_burner_ignition', 'Surface Burner Ignition'),
          gb('convection_operation', 'Convection Fan (if equipped)'),
          gb('door_lock_operation', 'Door Lock / Self-Clean Lock'),
        ],
      },
      {
        id: 'electrical_at_board',
        title: 'Electrical at Board / Valve',
        fields: [
          txt('supply_voltage', 'Supply voltage at outlet (V)'),
          txt('board_supply_voltage', 'Board supply voltage (V)'),
          txt('igniter_amps', 'Oven igniter amps (glow)'),
          txt('igniter_resistance', 'Oven igniter resistance cold (Ω)'),
          txt('gas_valve_coil_ohms', 'Gas valve coil resistance (Ω)'),
          txt('flame_sensor_continuity', 'Flame sensor / safety continuity'),
        ],
      },
      {
        id: 'gas_flame_readings',
        title: 'Gas / Flame Readings',
        fields: [
          gb('oven_flame_quality', 'Oven Flame Quality'),
          gb('surface_flame_quality', 'Surface Flame Quality'),
          txt('manifold_pressure', 'Manifold / gas pressure (if measured)'),
          txt('gas_notes', 'Gas line / regulator notes'),
        ],
      },
      {
        id: 'board_readings',
        title: 'Control Board Readings',
        fields: [
          txt('valve_voltage_on', 'Gas valve voltage when commanded (V)'),
          txt('igniter_circuit_voltage', 'Igniter circuit voltage (V)'),
          area('board_notes', 'Board relay / safety circuit notes'),
        ],
      },
      diagnosis(),
    ],
  },
  {
    id: 'microwave',
    label: 'Microwave',
    equipmentKeys: ['microwave'],
    sections: [
      missed([
        chk('door_switch', 'Door switch operation'),
        chk('installation', 'Installation / clearance'),
        chk('misuse', 'Customer misuse / metal'),
        chk('door_latching', 'Intermittent door latching'),
        chk('ventilation', 'Over-range vent / grease filter'),
      ]),
      complaint([txt('error_codes', 'Error Codes')]),
      {
        id: 'visual_inspection',
        title: 'Visual Inspection',
        fields: [
          gb('door_condition', 'Door Condition'),
          gb('latch_condition', 'Latch / Hooks Condition'),
          gb('waveguide_condition', 'Waveguide / Stirrer Cover'),
          tri('turntable_support', 'Turntable / support ring'),
        ],
      },
      {
        id: 'functional_checks',
        title: 'Functional Checks',
        fields: [
          yn('powers_on', 'Unit Powers On'),
          yn('heats_properly', 'Heats Properly (water test)'),
          gb('turntable_operation', 'Turntable Operation'),
          gb('fan_operation', 'Cooling / stirrer Fan'),
          gb('cooktop_lights', 'Cooktop / cavity lights (if equipped)'),
        ],
      },
      {
        id: 'door_safety',
        title: 'Door & Safety Switch Readings',
        fields: [
          txt('primary_door_switch', 'Primary door switch continuity'),
          txt('monitor_switch', 'Monitor switch continuity'),
          txt('thermal_cutout', 'Thermal cutout / thermostat'),
          txt('fuse_continuity', 'Line fuse continuity'),
        ],
      },
      {
        id: 'electrical_hv',
        title: 'Electrical / HV Circuit (de-energized)',
        fields: [
          txt('supply_voltage', 'Supply voltage (V)'),
          txt('magnetron_ohms', 'Magnetron resistance (Ω) — if tested'),
          txt('hv_diode', 'HV diode — if tested'),
          txt('capacitor_uf', 'High-voltage capacitor (µF) — if tested'),
          area('hv_notes', 'HV circuit notes (capacitor discharged?)'),
        ],
      },
      diagnosis(),
    ],
  },
];

const TEMPLATE_ALIASES = {
  range_oven: 'electric_range',
  dryer: 'electric_dryer',
};

const TEMPLATE_BY_ID = Object.fromEntries(DIAGNOSTIC_TEMPLATES.map((t) => [t.id, t]));

const SUBTYPE_TO_TEMPLATE = {};
for (const template of DIAGNOSTIC_TEMPLATES) {
  for (const key of template.equipmentKeys) {
    SUBTYPE_TO_TEMPLATE[key] = template.id;
  }
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function getDiagnosticTemplate(templateId) {
  const resolved = TEMPLATE_ALIASES[templateId] || templateId;
  return TEMPLATE_BY_ID[resolved] || null;
}

function inferRangeTemplateId(workOrder) {
  const blob = [
    workOrder?.description,
    workOrder?.equipment_notes,
    workOrder?.equipment_make,
    workOrder?.equipment_model,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\b(gas|lp|propane|natural gas|ng)\b/.test(blob)) return 'gas_range';
  if (/\b(electric|induction|240v|208v)\b/.test(blob)) return 'electric_range';
  return 'electric_range';
}

function inferDryerTemplateId(workOrder) {
  const blob = [
    workOrder?.description,
    workOrder?.equipment_notes,
    workOrder?.equipment_make,
    workOrder?.equipment_model,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\b(gas|lp|propane|natural gas|ng)\b/.test(blob)) return 'gas_dryer';
  return 'electric_dryer';
}

export function resolveDefaultDiagnosticTemplateId(workOrder) {
  if (!workOrder) return DIAGNOSTIC_TEMPLATES[0].id;
  const subtype = normalizeKey(workOrder.equipment_subtype);
  const equipType = normalizeKey(workOrder.equipment_type);
  if (subtype === 'gas_dryer') return 'gas_dryer';
  if (subtype === 'gas_range') return 'gas_range';
  if (subtype === 'electric_range') return 'electric_range';
  if (subtype === 'dryer' || equipType === 'dryer') return inferDryerTemplateId(workOrder);
  if (['range', 'oven', 'wall_oven'].includes(subtype) || ['range', 'oven', 'wall_oven'].includes(equipType)) {
    return inferRangeTemplateId(workOrder);
  }
  if (subtype && SUBTYPE_TO_TEMPLATE[subtype]) return SUBTYPE_TO_TEMPLATE[subtype];
  if (equipType && SUBTYPE_TO_TEMPLATE[equipType]) return SUBTYPE_TO_TEMPLATE[equipType];
  if (equipType === 'appliance' && subtype) return SUBTYPE_TO_TEMPLATE[subtype] || 'refrigerator';
  return 'refrigerator';
}

export function listDiagnosticTemplates() {
  return DIAGNOSTIC_TEMPLATES.map(({ id, label }) => ({ id, label }));
}

export function getInitialDiagnosticFieldValues(templateId, workOrder = null) {
  const template = getDiagnosticTemplate(templateId);
  if (!template) return {};
  const fields = {};
  for (const section of template.sections) {
    for (const field of section.fields) {
      const key = `${section.id}.${field.id}`;
      if (field.type === 'check') fields[key] = false;
      else fields[key] = '';
    }
  }
  const symptomText = Array.isArray(workOrder?.symptoms) && workOrder.symptoms.length
    ? workOrder.symptoms.join(', ')
    : '';
  if (workOrder?.description || symptomText) {
    fields['customer_complaint.complaint'] = workOrder.description || symptomText || '';
  }
  applyComplaintChipInference(
    templateId,
    fields,
    fields['customer_complaint.complaint'] || '',
  );
  return fields;
}

export function buildInitialDiagnosticState(workOrder) {
  const templateId = resolveDefaultDiagnosticTemplateId(workOrder);
  const fields = getInitialDiagnosticFieldValues(templateId, workOrder);
  return {
    templateId,
    appointmentId: suggestDefaultAppointmentId(workOrder),
    fields,
    timeline: [],
    evidenceSnapshot: null,
    autoNoteBullets: [],
    autoNoteEdited: false,
    autoNoteFormat: 'bullets',
    includeAutoNoteInSummary: true,
  };
}

export function suggestDefaultAppointmentId(workOrder) {
  const appts = Array.isArray(workOrder?.appointments) ? workOrder.appointments : [];
  const open = appts.filter((a) => String(a.status || '').toLowerCase() !== 'canceled');
  if (!open.length) return '';
  const sorted = [...open].sort(
    (a, b) => new Date(b.scheduled_start || 0) - new Date(a.scheduled_start || 0),
  );
  return sorted[0]?.id ? String(sorted[0].id) : '';
}

const VALUE_LABELS = {
  not_checked: 'Not Checked',
  good: 'Good',
  bad: 'Bad',
  yes: 'Yes',
  no: 'No',
  normal: 'Normal',
  excessive: 'Excessive',
};

function formatFieldValue(field, raw) {
  if (field.type === 'check') return raw ? 'Reviewed' : '—';
  if (!raw) return '—';
  return VALUE_LABELS[raw] || raw;
}

export function formatAppointmentTypeLabel(type) {
  if (!type) return 'Visit';
  const normalized = String(type).replace(/_/g, ' ').trim();
  if (!normalized) return 'Visit';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatDiagnosticVisitLabel(appointment) {
  if (!appointment) return null;
  const type = formatAppointmentTypeLabel(appointment.appointment_type);
  const when = appointment.scheduled_start
    ? format(new Date(appointment.scheduled_start), 'MMM d, h:mm a')
    : 'Unscheduled';
  return `${type} — ${when}`;
}

function resolveDiagnosticVisitLabel(appointmentId, appointments = []) {
  if (!appointmentId) return null;
  const appt = (appointments || []).find((a) => String(a.id) === String(appointmentId));
  return formatDiagnosticVisitLabel(appt);
}

export function formatDiagnosticNoteSummary(payload) {
  if (payload?.includeAutoNoteInSummary === false || !payload?.autoNoteBullets?.length) {
    return '';
  }
  const lines = ['Diagnostic summary:'];
  if (payload?.autoNoteFormat === 'prose') {
    lines.push('');
    lines.push(payload.autoNoteBullets.join('\n\n'));
  } else {
    for (const bullet of payload.autoNoteBullets) {
      const text = String(bullet || '').trim();
      if (text) lines.push(`• ${text}`);
    }
  }
  return lines.join('\n');
}

export function formatDiagnosticChecklist(payload, options = {}) {
  const template = getDiagnosticTemplate(payload?.templateId);
  if (!template) return '';
  const lines = [];
  lines.push(`Appliance: ${template.label}`);
  const appointments = options.appointments ?? options.workOrder?.appointments ?? [];
  const visitLabel = resolveDiagnosticVisitLabel(payload?.appointmentId, appointments);
  if (visitLabel) lines.push(`Visit: ${visitLabel}`);
  for (const section of template.sections) {
    const sectionLines = [];
    for (const field of section.fields) {
      const key = `${section.id}.${field.id}`;
      const val = payload?.fields?.[key];
      if (field.type === 'check' && !val) continue;
      if (!val && field.type !== 'check') continue;
      sectionLines.push(`  ${field.label}: ${formatFieldValue(field, val)}`);
    }
    if (sectionLines.length) {
      lines.push(`${section.title}:`);
      lines.push(...sectionLines);
    }
  }
  return lines.join('\n');
}

export function formatDiagnosticSummary(payload, options = {}) {
  const template = getDiagnosticTemplate(payload?.templateId);
  if (!template) return payload?.rawText || 'Diagnostic Results';
  const summary = formatDiagnosticNoteSummary(payload);
  const checklist = formatDiagnosticChecklist(payload, options);
  if (summary && checklist) return `${summary}\n\n${checklist}`;
  return summary || checklist || 'Diagnostic Results';
}

export function parseDiagnosticNotePayload(content) {
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object' && data.templateId) {
      return {
        templateId: data.templateId,
        appointmentId: data.appointmentId || '',
        fields: data.fields || {},
        timeline: Array.isArray(data.timeline) ? data.timeline : [],
        evidenceSnapshot: data.evidenceSnapshot || null,
        autoNoteBullets: Array.isArray(data.autoNoteBullets) ? data.autoNoteBullets : [],
        autoNoteEdited: Boolean(data.autoNoteEdited),
        autoNoteFormat: data.autoNoteFormat === 'prose' ? 'prose' : 'bullets',
        includeAutoNoteInSummary: data.includeAutoNoteInSummary !== false,
      };
    }
  } catch {
    // fall through
  }
  return buildInitialDiagnosticState(null);
}

export function serializeDiagnosticNotePayload(payload) {
  return JSON.stringify({
    templateId: payload.templateId,
    appointmentId: payload.appointmentId || null,
    fields: payload.fields || {},
    timeline: Array.isArray(payload.timeline) ? payload.timeline : [],
    evidenceSnapshot: payload.evidenceSnapshot || null,
    autoNoteBullets: Array.isArray(payload.autoNoteBullets) ? payload.autoNoteBullets : [],
    autoNoteEdited: Boolean(payload.autoNoteEdited),
    autoNoteFormat: payload.autoNoteFormat === 'prose' ? 'prose' : 'bullets',
    includeAutoNoteInSummary: payload.includeAutoNoteInSummary !== false,
  });
}
