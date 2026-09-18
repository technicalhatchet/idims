import type { CanonicalOntology, CanonicalPlatformOverlayFile } from './canonicalTypes';

import frontLoadWasherOntology from './front_load_washer.json';

import frontLoadWasherOverlay from './platform_overlays/front_load_washer.reference.json';

import topLoadWasherOntology from './top_load_washer.json';

import topLoadWasherOverlay from './platform_overlays/top_load_washer.reference.json';

import ventedDryerOntology from './vented_dryer.json';

import ventedDryerOverlay from './platform_overlays/vented_dryer.reference.json';

import dishwasherOntology from './dishwasher.json';

import dishwasherOverlay from './platform_overlays/dishwasher.reference.json';

import frenchDoorRefrigeratorOntology from './french_door_refrigerator.json';

import frenchDoorRefrigeratorOverlay from './platform_overlays/french_door_refrigerator.reference.json';

import electricRangeOntology from './electric_range.json';

import electricRangeOverlay from './platform_overlays/electric_range.reference.json';

import rangeOvenOntologyFile from './range_oven.json';

import rangeOvenOverlay from './platform_overlays/range_oven.reference.json';

import microwaveOntology from './microwave.json';

import microwaveOverlay from './platform_overlays/microwave.reference.json';

import heatPumpDryerOntology from './heat_pump_dryer.json';

import heatPumpDryerOverlay from './platform_overlays/heat_pump_dryer.reference.json';

import aioLaundryComboOntology from './aio_laundry_combo.json';

import aioLaundryComboOverlay from './platform_overlays/aio_laundry_combo.reference.json';

import {
  isRangeImplementationTemplateId,
  PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID,
  resolvePrimaryCanonicalOntologyId,
} from './canonicalOntologyAliases';

import { getPlatformRule } from '../platformRegistry';

const ELECTRIC_RANGE_REV1_HASH =
  '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

const MICROWAVE_REV1_HASH =
  '3c9ef98e07c0b87d5f3ea9e313deb21892d75fd563bff397a0cc33aba55e533d';

const HEAT_PUMP_DRYER_REV1_HASH =
  'd7a98c826d011a9fdef4b8c91ebd4d66ff88629f7d7b91357d43fee42c32d3bb';

const AIO_LAUNDRY_COMBO_REV1_HASH =
  'be3799a991b3d778b62e60a7ec3d91dfd6fe82432e3f9ac8663d607008081183';

const DRYER_TEMPLATE_IDS = new Set(['electric_dryer', 'gas_dryer']);

const HEAT_PUMP_DRYER_PLATFORM_PREFIXES = [
  'samsung_hp_dryer',
  'lg_hp_dryer',
  'whirlpool_hp_dryer',
  'whirlpool_hybridcare',
];

const ONTOLOGY_BY_ID: Record<string, CanonicalOntology> = {
  front_load_washer: frontLoadWasherOntology as CanonicalOntology,

  top_load_washer: topLoadWasherOntology as CanonicalOntology,

  vented_dryer: ventedDryerOntology as CanonicalOntology,

  dishwasher: dishwasherOntology as CanonicalOntology,

  french_door_refrigerator: frenchDoorRefrigeratorOntology as CanonicalOntology,

  electric_range: electricRangeOntology as CanonicalOntology,

  range_oven: rangeOvenOntologyFile as CanonicalOntology,

  microwave: microwaveOntology as CanonicalOntology,

  heat_pump_dryer: heatPumpDryerOntology as CanonicalOntology,

  aio_laundry_combo: aioLaundryComboOntology as CanonicalOntology,
};

const OVERLAY_BY_ONTOLOGY: Record<string, CanonicalPlatformOverlayFile> = {
  front_load_washer: frontLoadWasherOverlay as CanonicalPlatformOverlayFile,

  top_load_washer: topLoadWasherOverlay as CanonicalPlatformOverlayFile,

  vented_dryer: ventedDryerOverlay as CanonicalPlatformOverlayFile,

  dishwasher: dishwasherOverlay as CanonicalPlatformOverlayFile,

  french_door_refrigerator: frenchDoorRefrigeratorOverlay as CanonicalPlatformOverlayFile,

  electric_range: electricRangeOverlay as unknown as CanonicalPlatformOverlayFile,

  range_oven: rangeOvenOverlay as unknown as CanonicalPlatformOverlayFile,

  microwave: microwaveOverlay as unknown as CanonicalPlatformOverlayFile,

  heat_pump_dryer: heatPumpDryerOverlay as unknown as CanonicalPlatformOverlayFile,

  aio_laundry_combo: aioLaundryComboOverlay as unknown as CanonicalPlatformOverlayFile,
};

const TOP_LOAD_PLATFORM_PREFIXES = ['whirlpool_tl', 'whirlpool_mvw', 'samsung_tl'];

const FRONT_LOAD_WASHER_PLATFORMS = new Set([
  'whirlpool_fl_dd',

  'whirlpool_duet_sport',

  'whirlpool_connected_smart_gen3',

  'samsung_fl_washer_bb8700',

  'samsung_fl_washer_wf6000r',

  'samsung_flexwash',
]);

function resolveRangeCanonicalOntologyId(
  templateId: string | null | undefined,
  platformRuleTemplateId?: string | null,
): string | null {
  if (isRangeImplementationTemplateId(templateId)) {
    return PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID;
  }
  if (platformRuleTemplateId && isRangeImplementationTemplateId(platformRuleTemplateId)) {
    return PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID;
  }
  return null;
}

export function resolveCanonicalOntologyId(
  templateId: string | null | undefined,

  platformId?: string | null,
): string | null {
  const platform = String(platformId || '');

  // Heat-pump dryer platforms route before vented_dryer catch-all.
  if (
    platform.includes('heat_pump') ||
    HEAT_PUMP_DRYER_PLATFORM_PREFIXES.some((prefix) => platform.startsWith(prefix))
  ) {
    return 'heat_pump_dryer';
  }

  // Vented dryer platforms — not heat-pump.
  if (platform.includes('_dryer')) {
    return 'vented_dryer';
  }

  // Dishwasher platforms route to dishwasher canonical graph.
  if (platform.includes('_dishwasher') || platform.includes('dishwasher_')) {
    return 'dishwasher';
  }

  // Refrigerator platforms route to French-door refrigerator canonical graph.
  if (platform.includes('fridge') || platform.includes('lrmvs') || platform.includes('refrigerator')) {
    return 'french_door_refrigerator';
  }

  // Microwave platforms route to microwave canonical graph.
  if (platform.includes('microwave')) {
    return 'microwave';
  }

  // AIO laundry combo platforms — before generic washer/dryer catch-alls.
  if (platform.includes('laundry_combo') || platform.endsWith('_aio')) {
    return 'aio_laundry_combo';
  }

  const platformRule = platform ? getPlatformRule(platform) : null;
  if (platformRule?.templateId === 'aio_laundry') {
    return 'aio_laundry_combo';
  }
  if (platformRule && DRYER_TEMPLATE_IDS.has(platformRule.templateId)) {
    return 'vented_dryer';
  }
  if (platformRule?.templateId === 'dishwasher') {
    return 'dishwasher';
  }
  if (platformRule?.templateId === 'refrigerator') {
    return 'french_door_refrigerator';
  }
  if (platformRule?.templateId === 'microwave') {
    return 'microwave';
  }

  const rangeFromPlatform = resolveRangeCanonicalOntologyId(null, platformRule?.templateId);
  if (rangeFromPlatform) {
    return rangeFromPlatform;
  }

  if (!templateId) return null;

  const rangeFromTemplate = resolveRangeCanonicalOntologyId(templateId, platformRule?.templateId);
  if (rangeFromTemplate) {
    return rangeFromTemplate;
  }

  if (DRYER_TEMPLATE_IDS.has(templateId)) {
    return 'vented_dryer';
  }

  if (templateId === 'dishwasher') {
    return 'dishwasher';
  }

  if (templateId === 'refrigerator') {
    return 'french_door_refrigerator';
  }

  if (templateId === 'microwave') {
    return 'microwave';
  }

  if (templateId === 'heat_pump_dryer') {
    return 'heat_pump_dryer';
  }

  if (templateId === 'aio_laundry') {
    return 'aio_laundry_combo';
  }

  if (templateId !== 'washer') return null;

  if (TOP_LOAD_PLATFORM_PREFIXES.some((prefix) => platform.startsWith(prefix))) {
    return 'top_load_washer';
  }

  if (FRONT_LOAD_WASHER_PLATFORMS.has(platform)) {
    return 'front_load_washer';
  }

  // Unclassified washer platforms default to FL until routed explicitly.

  return 'front_load_washer';
}

export function getCanonicalOntologyForTemplate(
  templateId: string | null | undefined,

  platformId?: string | null,
): CanonicalOntology | null {
  const ontologyId = resolveCanonicalOntologyId(templateId, platformId);

  if (!ontologyId) return null;

  return ONTOLOGY_BY_ID[ontologyId] ?? null;
}

export function getCanonicalOntologyById(ontologyId: string): CanonicalOntology | null {
  const primaryId = resolvePrimaryCanonicalOntologyId(ontologyId);
  if (!primaryId) return null;
  return ONTOLOGY_BY_ID[primaryId] ?? null;
}

export function getPlatformOverlayForOntology(
  ontologyId: string,

  platformId: string,
) {
  const primaryId = resolvePrimaryCanonicalOntologyId(ontologyId) ?? ontologyId;
  const file = OVERLAY_BY_ONTOLOGY[primaryId];

  if (!file) return null;

  return file.platforms.find((platform) => platform.platformId === platformId) ?? null;
}

/** CG-10 immutable freeze hash — used by regression tests; electric_range.json must not change. */
export const FROZEN_ELECTRIC_RANGE_REV1_HASH = ELECTRIC_RANGE_REV1_HASH;

/** CG-MICROWAVE-FREEZE immutable freeze hash — used by regression tests; microwave.json must not change. */
export const FROZEN_MICROWAVE_REV1_HASH = MICROWAVE_REV1_HASH;

/** CG-HEAT-PUMP-DRYER-FREEZE immutable freeze hash — used by regression tests; heat_pump_dryer.json must not change. */
export const FROZEN_HEAT_PUMP_DRYER_REV1_HASH = HEAT_PUMP_DRYER_REV1_HASH;

/** CG-AIO-LAUNDRY-COMBO-FREEZE immutable freeze hash — used by regression tests; aio_laundry_combo.json must not change after lock. */
export const FROZEN_AIO_LAUNDRY_COMBO_REV1_HASH = AIO_LAUNDRY_COMBO_REV1_HASH;
