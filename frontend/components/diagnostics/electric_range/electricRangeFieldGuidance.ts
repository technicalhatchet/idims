import type { FieldRecommendationRule } from '../routing/types';

export const electricRangeFieldHelp: Record<string, string> = {
  'commonly_missed.incoming_voltage':
    'Verify 240V across L1–L2 at the terminal block before chasing elements.',
  'commonly_missed.terminal_burn':
    'Loose or burnt lugs cause intermittent heat and repeated element failures.',
  'visual_inspection.terminal_block':
    'Look for discoloration, melted plastic, or loose connections.',
  'visual_inspection.bake_element_visible':
    'Blistering, breaks, or bright spots in the element sheath are common bake failures.',
  'functional_checks.bake_operation':
    'Listen for relay click and confirm amp draw if the element should be on.',
  'functional_checks.broil_operation':
    'Broil uses high wattage — confirm relay output and element continuity.',
  'terminal_block_readings.l1_l2_voltage':
    'Expect ~240V on a standard electric range feed (208V on some commercial).',
  'element_sensor_readings.bake_element_ohms':
    'Open element = no heat. Compare to spec — typically 15–50Ω.',
  'element_sensor_readings.temp_sensor_ohms':
    'Room-temp sensor resistance should match manufacturer chart (often ~1kΩ).',
  'board_readings.bake_relay_output':
    '240V to bake leg when commanded — if not, suspect relay or board.',
  'diagnosis.root_cause':
    'Document voltage at block, element ohms, and relay output before calling the board.',
};

export const electricRangeRecommendations: FieldRecommendationRule[] = [
  {
    id: 'no_power_terminal',
    when: [{ type: 'chip', id: 'no_power' }],
    message: 'No power — start at breaker, outlet, and terminal block before board tests.',
    tone: 'action',
  },
  {
    id: 'no_bake_path',
    field: 'functional_checks.bake_operation',
    when: [{ type: 'chip', id: 'no_bake' }],
    message: 'No bake — check bake element ohms, relay output, and temp sensor.',
    tone: 'action',
  },
  {
    id: 'bake_bad',
    field: 'functional_checks.bake_operation',
    when: [{ type: 'field', path: 'functional_checks.bake_operation', equals: 'bad' }],
    message: 'Bake failed functional — measure element and relay leg before replacing board.',
    tone: 'tip',
  },
  {
    id: 'terminal_bad',
    field: 'visual_inspection.terminal_block',
    when: [{ type: 'field', path: 'visual_inspection.terminal_block', equals: 'bad' }],
    message: 'Bad terminal block — repair wiring before replacing elements or controls.',
    tone: 'action',
  },
  {
    id: 'error_code_board',
    when: [{ type: 'chip', id: 'error_code' }],
    message: 'Error code — note exact code; verify sensor and lock circuits before board.',
    tone: 'tip',
  },
];
