import type { MeasurementContext } from './types';
import { expandOemModelVariants } from './whirlpoolOemRebadge';

export const PLATFORM_IDS = {
  WHIRLPOOL_FL_DD: 'whirlpool_fl_dd',
  WHIRLPOOL_DUET_SPORT: 'whirlpool_duet_sport',
  WHIRLPOOL_DUET_SPORT_DRYER: 'whirlpool_duet_sport_dryer',
  SAMSUNG_FLEXWASH: 'samsung_flexwash',
  SAMSUNG_SXS: 'samsung_sxs',
  LG_LRMVS: 'lg_lrmvs',
  WHIRLPOOL_WRT_TOP_MOUNT: 'whirlpool_wrt_top_mount',
  WHIRLPOOL_WRT311_ADC: 'whirlpool_wrt311_adc',
  WHIRLPOOL_MODULAR_ICE_MAKER: 'whirlpool_modular_ice_maker',
  WHIRLPOOL_JAZZ_FRENCH_DOOR: 'whirlpool_jazz_french_door',
  WHIRLPOOL_KA_FRENCH_DOOR: 'whirlpool_ka_french_door',
  MIDEA_RSS: 'midea_rss',
  MIDEA_UZ21: 'midea_uz21',
  INSIGNIA_WASHER_CAP: 'insignia_washer_cap',
  INSIGNIA_WASHER_FREQ: 'insignia_washer_freq',
  WHIRLPOOL_DISHWASHER_ACU: 'whirlpool_dishwasher_acu',
  INSIGNIA_DISHWASHER: 'insignia_dishwasher',
  LG_DISHWASHER_LDT: 'lg_dishwasher_ldt',
  INSIGNIA_DRYER_TDRE: 'insignia_dryer_tdre',
  WHIRLPOOL_CCU_DRYER: 'whirlpool_ccu_dryer',
} as const;

export type PlatformId = (typeof PLATFORM_IDS)[keyof typeof PLATFORM_IDS];

export interface PlatformRule {
  id: PlatformId;
  label: string;
  manufacturers: string[];
  templateId: string;
  modelPatterns?: RegExp[];
}

export const PLATFORM_RULES: PlatformRule[] = [
  {
    id: PLATFORM_IDS.WHIRLPOOL_DUET_SPORT,
    label: 'Whirlpool/Maytag Duet Sport CCU/MCU front-load',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'washer',
    modelPatterns: [
      /WFW83/i, /WFW85/i, /WFW92/i, /WFW94/i, /WFW95/i,
      /MHWE83/i, /MHWE85/i, /MHWE92/i, /MHWE94/i, /MHWE95/i, /MHWE/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_FL_DD,
    label: 'Whirlpool 27" front-load direct drive',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'washer',
    modelPatterns: [/WFW/i, /MHW/i, /CHW/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_FLEXWASH,
    label: 'Samsung FlexWash dual-load',
    manufacturers: ['Samsung'],
    templateId: 'washer',
    modelPatterns: [/WV55/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_SXS,
    label: 'Samsung side-by-side refrigerator',
    manufacturers: ['Samsung'],
    templateId: 'refrigerator',
  },
  {
    id: PLATFORM_IDS.LG_LRMVS,
    label: 'LG InstaView 4-door',
    manufacturers: ['LG'],
    templateId: 'refrigerator',
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_WRT311_ADC,
    label: 'Whirlpool WRT311 ADC 2000 top-mount',
    manufacturers: ['Whirlpool', 'Maytag', 'Amana'],
    templateId: 'refrigerator',
    modelPatterns: [/WRT311/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_WRT_TOP_MOUNT,
    label: 'Whirlpool / Maytag / Amana top-mount (WRT family)',
    manufacturers: ['Whirlpool', 'Maytag', 'Amana'],
    templateId: 'refrigerator',
    modelPatterns: [/WRT/i, /W8T/i, /W4T/i, /MRT/i, /ART/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_MODULAR_ICE_MAKER,
    label: 'Whirlpool modular ice maker (2225623)',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid', 'Amana'],
    templateId: 'refrigerator',
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_JAZZ_FRENCH_DOOR,
    label: 'Whirlpool/Maytag/KA Jazz French door (W10322959)',
    manufacturers: ['Whirlpool', 'KitchenAid', 'Maytag'],
    templateId: 'refrigerator',
    modelPatterns: [
      /WRF53/i, /WRF54/i, /WRF55/i, /WRF56/i, /WRF98/i, /WRF99/i,
      /KRMF55/i, /KRFF5/i, /GI5F/i,
      /MFF5/i, /MFI5/i, /MFT5/i, /MFW5/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_KA_FRENCH_DOOR,
    label: 'Whirlpool/Maytag/KA French door (ACU)',
    manufacturers: ['Whirlpool', 'KitchenAid', 'Maytag'],
    templateId: 'refrigerator',
    modelPatterns: [
      /WRF7/i, /WRF8/i, /KRMF70/i, /KRMF706/i, /KRFF7/i,
      /MFI7/i, /MFT7/i, /MFF7/i,
    ],
  },
  {
    id: PLATFORM_IDS.MIDEA_RSS,
    label: 'Midea / Insignia RSS & top-freezer',
    manufacturers: ['Insignia'],
    templateId: 'refrigerator',
    modelPatterns: [/NS-RSS/i, /NS-RTM/i],
  },
  {
    id: PLATFORM_IDS.MIDEA_UZ21,
    label: 'Midea / Insignia upright freezer UZ21',
    manufacturers: ['Insignia'],
    templateId: 'standalone_freezer',
    modelPatterns: [/NS-UZ/i],
  },
  {
    id: PLATFORM_IDS.INSIGNIA_WASHER_CAP,
    label: 'Insignia capacitive-level washer (TWM41/TWM35)',
    manufacturers: ['Insignia'],
    templateId: 'washer',
    modelPatterns: [/TWM41/i, /TWM35/i],
  },
  {
    id: PLATFORM_IDS.INSIGNIA_WASHER_FREQ,
    label: 'Insignia frequency-level washer (WMT41)',
    manufacturers: ['Insignia'],
    templateId: 'washer',
    modelPatterns: [/WMT41/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_DISHWASHER_ACU,
    label: 'Whirlpool/Maytag/KitchenAid ACU dishwasher',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'dishwasher',
  },
  {
    id: PLATFORM_IDS.INSIGNIA_DISHWASHER,
    label: 'Insignia DWR3 dishwasher',
    manufacturers: ['Insignia'],
    templateId: 'dishwasher',
    modelPatterns: [/DWR/i],
  },
  {
    id: PLATFORM_IDS.LG_DISHWASHER_LDT,
    label: 'LG LDT top-control dishwasher',
    manufacturers: ['LG'],
    templateId: 'dishwasher',
    modelPatterns: [/LDT/i],
  },
  {
    id: PLATFORM_IDS.INSIGNIA_DRYER_TDRE,
    label: 'Insignia TDRE75 dryer',
    manufacturers: ['Insignia'],
    templateId: 'electric_dryer',
    modelPatterns: [/TDRE/i],
  },
  {
    id: PLATFORM_IDS.INSIGNIA_DRYER_TDRE,
    label: 'Insignia TDRE75 dryer (gas)',
    manufacturers: ['Insignia'],
    templateId: 'gas_dryer',
    modelPatterns: [/TDRE/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_DUET_SPORT_DRYER,
    label: 'Whirlpool/Maytag Duet Sport MCE dryer',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'electric_dryer',
    modelPatterns: [
      /WED83/i, /WED85/i, /WGD83/i, /WGD85/i,
      /MED83/i, /MED85/i, /MGD83/i, /MGD85/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_DUET_SPORT_DRYER,
    label: 'Whirlpool/Maytag Duet Sport MCE dryer (gas)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'gas_dryer',
    modelPatterns: [
      /WED83/i, /WED85/i, /WGD83/i, /WGD85/i,
      /MED83/i, /MED85/i, /MGD83/i, /MGD85/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CCU_DRYER,
    label: 'Whirlpool / Maytag CCU dryer',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'electric_dryer',
    modelPatterns: [/WED/i, /WGD/i, /MED/i, /MGD/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CCU_DRYER,
    label: 'Whirlpool / Maytag CCU dryer (gas)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'gas_dryer',
    modelPatterns: [/WED/i, /WGD/i, /MED/i, /MGD/i],
  },
];

const MAKE_ALIASES: Record<string, string> = {
  kitchenaid: 'KitchenAid',
  whirlpool: 'Whirlpool',
  maytag: 'Maytag',
  samsung: 'Samsung',
  lg: 'LG',
  insignia: 'Insignia',
  ge: 'GE',
  frigidaire: 'Frigidaire',
};

export function normalizeMake(value: string | null | undefined): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  if (MAKE_ALIASES[key]) return MAKE_ALIASES[key];
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function getPlatformRule(platformId: string | null | undefined): PlatformRule | null {
  if (!platformId) return null;
  return PLATFORM_RULES.find((rule) => rule.id === platformId) || null;
}

/** Platform resolved only when model matches a platform modelPattern (explicit platform). */
export function resolvePlatformIdFromModel(ctx: MeasurementContext): PlatformId | null {
  const make = normalizeMake(ctx.equipmentMake);
  if (!make || !ctx.templateId) return null;

  const model = String(ctx.equipmentModel || '').trim();
  if (!model) return null;

  const modelVariants = expandOemModelVariants(make, model);

  const candidates = PLATFORM_RULES.filter(
    (rule) =>
      rule.templateId === ctx.templateId
      && rule.manufacturers.includes(make)
      && rule.modelPatterns?.some((pattern) =>
        modelVariants.some((variant) => pattern.test(variant)),
      ),
  );

  return candidates[0]?.id ?? null;
}

/**
 * @deprecated Prefer resolvePlatformIdFromModel for platform-specific logic.
 * Returns explicit model match, else a make-wide platform rule (no modelPatterns).
 */
export function resolvePlatformId(ctx: MeasurementContext): PlatformId | null {
  const fromModel = resolvePlatformIdFromModel(ctx);
  if (fromModel) return fromModel;

  const make = normalizeMake(ctx.equipmentMake);
  if (!make || !ctx.templateId) return null;

  const candidates = PLATFORM_RULES.filter(
    (rule) => rule.templateId === ctx.templateId && rule.manufacturers.includes(make),
  );
  if (!candidates.length) return null;

  const brandWide = candidates.find((rule) => !rule.modelPatterns?.length);
  return brandWide?.id ?? null;
}

/** Platform clause / field visibility: explicit model match, or brand-wide platform for make. */
export function platformMatches(
  ctx: MeasurementContext | null | undefined,
  platformId: string,
): boolean {
  if (!ctx?.templateId) return false;

  const explicit = resolvePlatformIdFromModel(ctx);
  if (explicit) return explicit === platformId;

  const make = normalizeMake(ctx.equipmentMake);
  if (!make) return false;

  const rule = getPlatformRule(platformId);
  if (!rule || rule.templateId !== ctx.templateId) return false;
  if (!rule.manufacturers.includes(make)) return false;

  return !rule.modelPatterns?.length;
}

export function getPlatformLabel(platformId: string | null | undefined): string | null {
  if (!platformId) return null;
  return PLATFORM_RULES.find((rule) => rule.id === platformId)?.label || null;
}

export function buildMeasurementContext({
  templateId,
  equipmentMake,
  equipmentModel,
}: {
  templateId?: string | null;
  equipmentMake?: string | null;
  equipmentModel?: string | null;
}): MeasurementContext {
  return {
    templateId: templateId || '',
    equipmentMake: equipmentMake?.trim() || null,
    equipmentModel: equipmentModel?.trim() || null,
  };
}
