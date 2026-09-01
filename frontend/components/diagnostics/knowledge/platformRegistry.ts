import type { MeasurementContext } from './types';

export const PLATFORM_IDS = {
  WHIRLPOOL_FL_DD: 'whirlpool_fl_dd',
  SAMSUNG_FLEXWASH: 'samsung_flexwash',
  SAMSUNG_SXS: 'samsung_sxs',
  LG_LRMVS: 'lg_lrmvs',
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
    id: PLATFORM_IDS.WHIRLPOOL_FL_DD,
    label: 'Whirlpool 27" front-load direct drive',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'washer',
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
    id: PLATFORM_IDS.WHIRLPOOL_KA_FRENCH_DOOR,
    label: 'Whirlpool / KitchenAid French door',
    manufacturers: ['Whirlpool', 'KitchenAid', 'Maytag'],
    templateId: 'refrigerator',
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
    label: 'Whirlpool / KitchenAid ACU dishwasher',
    manufacturers: ['Whirlpool', 'KitchenAid'],
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
    id: PLATFORM_IDS.WHIRLPOOL_CCU_DRYER,
    label: 'Whirlpool / Maytag CCU dryer',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'electric_dryer',
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CCU_DRYER,
    label: 'Whirlpool / Maytag CCU dryer (gas)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'gas_dryer',
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

export function resolvePlatformId(ctx: MeasurementContext): PlatformId | null {
  const make = normalizeMake(ctx.equipmentMake);
  if (!make || !ctx.templateId) return null;

  const candidates = PLATFORM_RULES.filter(
    (rule) => rule.templateId === ctx.templateId && rule.manufacturers.includes(make),
  );
  if (!candidates.length) return null;

  const model = String(ctx.equipmentModel || '').trim();
  if (model) {
    const modelMatch = candidates.find((rule) =>
      rule.modelPatterns?.some((pattern) => pattern.test(model)),
    );
    if (modelMatch) return modelMatch.id;
  }

  const generic = candidates.find((rule) => !rule.modelPatterns?.length);
  return generic?.id ?? null;
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
