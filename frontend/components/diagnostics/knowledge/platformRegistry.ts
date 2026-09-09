import type { MeasurementContext } from './types';
import { expandOemModelVariants } from './whirlpoolOemRebadge';

export const PLATFORM_IDS = {
  WHIRLPOOL_TL_DD_5100: 'whirlpool_tl_dd_5100',
  WHIRLPOOL_TL_DD_4100: 'whirlpool_tl_dd_4100',
  WHIRLPOOL_TL_DD: 'whirlpool_tl_dd',
  WHIRLPOOL_FL_DD: 'whirlpool_fl_dd',
  WHIRLPOOL_DUET_SPORT: 'whirlpool_duet_sport',
  WHIRLPOOL_DUET_SPORT_DRYER: 'whirlpool_duet_sport_dryer',
  SAMSUNG_FLEXWASH: 'samsung_flexwash',
  SAMSUNG_SXS: 'samsung_sxs',
  SAMSUNG_FRIDGE_BESPOKE: 'samsung_fridge_bespoke',
  SAMSUNG_FL_WASHER_BB8700: 'samsung_fl_washer_bb8700',
  SAMSUNG_FL_DRYER_BB8700: 'samsung_fl_dryer_bb8700',
  SAMSUNG_FL_DRYER_DV6000: 'samsung_fl_dryer_dv6000',
  SAMSUNG_TL_WASHER_A50: 'samsung_tl_washer_a50',
  SAMSUNG_TL_DRYER_DV50: 'samsung_tl_dryer_dv50',
  SAMSUNG_RANGE_NX60: 'samsung_range_nx60',
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
  WHIRLPOOL_DISHWASHER_ADA: 'whirlpool_dishwasher_ada',
  INSIGNIA_DISHWASHER: 'insignia_dishwasher',
  LG_DISHWASHER_LDT: 'lg_dishwasher_ldt',
  LG_DISHWASHER_LDT7808: 'lg_dishwasher_ldt7808',
  LG_MICROWAVE_OTR: 'lg_microwave_otr',
  INSIGNIA_DRYER_TDRE: 'insignia_dryer_tdre',
  WHIRLPOOL_CCU_DRYER: 'whirlpool_ccu_dryer',
  WHIRLPOOL_CENTENNIAL_DRYER: 'whirlpool_centennial_dryer',
  WHIRLPOOL_ACU_TL_DRYER: 'whirlpool_acu_tl_dryer',
  WHIRLPOOL_MWV6200: 'whirlpool_mvw6200',
  WHIRLPOOL_TL_DD_6157: 'whirlpool_tl_dd_6157',
  WHIRLPOOL_FREESTANDING_RANGE: 'whirlpool_freestanding_range',
  WHIRLPOOL_CONNECTED_SMART_GEN3: 'whirlpool_connected_smart_gen3',
  FRIGIDAIRE_PRMC_FRENCH_DOOR: 'frigidaire_prmc_french_door',
  GE_GUD27_STACKED: 'ge_gud27_stacked',
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
    id: PLATFORM_IDS.WHIRLPOOL_CONNECTED_SMART_GEN3,
    label: 'Whirlpool Connected Smart Appliance Gen III (W10785366A smart layer)',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'washer',
    modelPatterns: [/WTW8700/i, /MTW8700/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CONNECTED_SMART_GEN3,
    label: 'Whirlpool Connected Smart Appliance Gen III (W10785366A smart layer)',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'electric_dryer',
    modelPatterns: [/WED8700/i, /MED8700/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CONNECTED_SMART_GEN3,
    label: 'Whirlpool Connected Smart Appliance Gen III (W10785366A smart layer)',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'gas_dryer',
    modelPatterns: [/WGD8700/i, /MGD8700/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CONNECTED_SMART_GEN3,
    label: 'Whirlpool Connected Smart Appliance Gen III (W10785366A smart layer)',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'dishwasher',
    modelPatterns: [/WDT995/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CONNECTED_SMART_GEN3,
    label: 'Whirlpool Connected Smart Appliance Gen III (W10785366A smart layer)',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'refrigerator',
    modelPatterns: [/WRF989/i, /WRF995/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_MWV6200,
    label: 'Whirlpool/Maytag 4.8 cu ft PSC top-load (W11416395)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'washer',
    modelPatterns: [/MVW62/i, /WTW62/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_TL_DD_6157,
    label: 'Whirlpool/Maytag 5.3 cu ft PSC top-load (W11455152)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'washer',
    modelPatterns: [/MVW61/i, /WTW61/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_TL_DD_5100,
    label: 'Whirlpool/Maytag 4.7/5.3 cu ft direct-drive top-load (W11416787)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'washer',
    modelPatterns: [/WTW51/i, /MVW51/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_TL_DD_4100,
    label: 'Whirlpool/Maytag 4.0–4.3 cu ft ACU belt-drive top-load (W11800233)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'washer',
    modelPatterns: [/WTW41/i, /MVW41/i, /WTW40/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_TL_DD,
    label: 'Whirlpool/Maytag 3.8 cu ft PSC top-load (W11697231)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'washer',
    modelPatterns: [/WTW49/i, /MVW49/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_TL_DD,
    label: 'Whirlpool/Maytag direct-drive top-load (W10864849)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'washer',
    modelPatterns: [/WTW/i, /MVW/i],
  },
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
    id: PLATFORM_IDS.SAMSUNG_TL_WASHER_A50,
    label: 'Samsung top-load washer A50 family (WA50R, WA51DG, WF45A)',
    manufacturers: ['Samsung'],
    templateId: 'washer',
    modelPatterns: [/WA50/i, /WF45A/i, /WA51D/i, /WA52D/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_TL_DRYER_DV50,
    label: 'Samsung top-load / vented dryer DV50R family (electric)',
    manufacturers: ['Samsung'],
    templateId: 'electric_dryer',
    modelPatterns: [/DVE50R/i, /DV50R/i, /DVE50/i, /DV50/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_TL_DRYER_DV50,
    label: 'Samsung top-load / vented dryer DV50R family (gas)',
    manufacturers: ['Samsung'],
    templateId: 'gas_dryer',
    modelPatterns: [/DVG50R/i, /DVG50/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_FL_DRYER_DV6000,
    label: 'Samsung front-load electric dryer DV6000T (DVE45T6000)',
    manufacturers: ['Samsung'],
    templateId: 'electric_dryer',
    modelPatterns: [/DV6000/i, /DVE45T/i, /DV45T60/i, /DVE60/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_FL_WASHER_BB8700,
    label: 'Samsung front-load washer BB8700 family',
    manufacturers: ['Samsung'],
    templateId: 'washer',
    modelPatterns: [/WF50BB/i, /WF53BB/i, /WF46BB/i, /WF50BG/i, /WF51CG/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_FL_DRYER_BB8700,
    label: 'Samsung front-load electric dryer BB8700 (DVE)',
    manufacturers: ['Samsung'],
    templateId: 'electric_dryer',
    modelPatterns: [/DVE53BB/i, /DVE50/i, /DVE46BB/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_FL_DRYER_BB8700,
    label: 'Samsung front-load gas dryer BB8700 (DVG)',
    manufacturers: ['Samsung'],
    templateId: 'gas_dryer',
    modelPatterns: [/DVG53BB/i, /DVG50/i, /DVG46BB/i, /DV53BB/i, /DV50/i],
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
    modelPatterns: [/RF260/i, /RF261/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_FRIDGE_BESPOKE,
    label: 'Samsung Bespoke 4-door French-door refrigerator (RF23BB / RF32CG)',
    manufacturers: ['Samsung'],
    templateId: 'refrigerator',
    modelPatterns: [/RF23BB/i, /RF24BB/i, /RF29BB/i, /RF30BB/i, /RF32CG/i, /RF31CG/i, /RF26CG/i, /RF27CG/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_RANGE_NX60,
    label: 'Samsung NX60/NE63 slide-in gas range',
    manufacturers: ['Samsung'],
    templateId: 'gas_range',
    modelPatterns: [/NX60/i, /NE63/i],
  },
  {
    id: PLATFORM_IDS.SAMSUNG_RANGE_NX60,
    label: 'Samsung NX60/NE63 slide-in electric range',
    manufacturers: ['Samsung'],
    templateId: 'electric_range',
    modelPatterns: [/NX60/i, /NE63/i],
  },
  {
    id: PLATFORM_IDS.LG_LRMVS,
    label: 'LG InstaView 4-door',
    manufacturers: ['LG'],
    templateId: 'refrigerator',
  },
  {
    id: PLATFORM_IDS.FRIGIDAIRE_PRMC_FRENCH_DOOR,
    label: 'Frigidaire Professional PRMC French-door (column evaporator)',
    manufacturers: ['Frigidaire', 'Frigidaire Professional'],
    templateId: 'refrigerator',
    modelPatterns: [/PRMC/i, /FRMC/i],
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
    label: 'KitchenAid premium ACU dishwasher (KDTM404/604/804)',
    manufacturers: ['KitchenAid'],
    templateId: 'dishwasher',
    modelPatterns: [/KDTM404/i, /KDTM604/i, /KDTM804/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_DISHWASHER_ACU,
    label: 'Whirlpool/Maytag/KitchenAid ACU dishwasher (WDT750 microfiltration)',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'dishwasher',
    modelPatterns: [/WDT75/i, /WDTA75/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_DISHWASHER_ACU,
    label: 'JennAir 24" Filtration ACU dishwasher',
    manufacturers: ['JennAir'],
    templateId: 'dishwasher',
    modelPatterns: [/JDP/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_DISHWASHER_ADA,
    label: 'Whirlpool ADA built-in dishwasher (W11187658)',
    manufacturers: ['Whirlpool'],
    templateId: 'dishwasher',
    modelPatterns: [/WDTA1/i, /WDT518/i, /WDT550/i, /WDF518/i, /WDF550/i, /WDF/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_DISHWASHER_ACU,
    label: 'Whirlpool/Maytag/KitchenAid/JennAir ACU dishwasher',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid', 'JennAir'],
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
    id: PLATFORM_IDS.LG_DISHWASHER_LDT7808,
    label: 'LG LDT7808 top-control dishwasher (QuadWash)',
    manufacturers: ['LG'],
    templateId: 'dishwasher',
    modelPatterns: [/LDT7808/i, /LSDT9908/i],
  },
  {
    id: PLATFORM_IDS.LG_DISHWASHER_LDT,
    label: 'LG LDT top-control dishwasher',
    manufacturers: ['LG'],
    templateId: 'dishwasher',
    modelPatterns: [/LDT/i],
  },
  {
    id: PLATFORM_IDS.LG_MICROWAVE_OTR,
    label: 'LG over-the-range microwave (LMHM/LMVM)',
    manufacturers: ['LG'],
    templateId: 'microwave',
    modelPatterns: [/LMHM/i, /LMVM/i],
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
    label: 'Insignia TDRG75 dryer (gas)',
    manufacturers: ['Insignia'],
    templateId: 'gas_dryer',
    modelPatterns: [/TDRG/i, /TDRE/i],
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
    id: PLATFORM_IDS.WHIRLPOOL_ACU_TL_DRYER,
    label: 'Whirlpool/Maytag ACU top-load dryer (W11798430/W11416805)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'electric_dryer',
    modelPatterns: [/WED41/i, /WED51/i, /MED41/i, /MED51/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_ACU_TL_DRYER,
    label: 'Whirlpool/Maytag ACU top-load dryer (W11798430/W11416805, gas)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'gas_dryer',
    modelPatterns: [/WGD41/i, /WGD51/i, /MGD41/i, /MGD51/i],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CENTENNIAL_DRYER,
    label: 'Whirlpool/Maytag Centennial timer+electronic dryer (8178629)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'electric_dryer',
    modelPatterns: [
      /MED55/i, /MGD55/i, /MED59/i, /MGD59/i,
      /WED55/i, /WGD55/i, /WED59/i, /WGD59/i,
      /WED4815/i, /WGD4815/i, /WED4915/i, /WGD4915/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CENTENNIAL_DRYER,
    label: 'Whirlpool/Maytag Centennial timer+electronic dryer (8178629, gas)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'gas_dryer',
    modelPatterns: [
      /MED55/i, /MGD55/i, /MED59/i, /MGD59/i,
      /WED55/i, /WGD55/i, /WED59/i, /WGD59/i,
      /WED4815/i, /WGD4815/i, /WED4915/i, /WGD4915/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CCU_DRYER,
    label: 'Whirlpool / Maytag CCU/ACU dryer',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'electric_dryer',
    modelPatterns: [
      /WED/i, /WGD/i, /MED/i, /MGD/i,
      /WED95/i, /MED95/i, /WGD95/i, /MGDB955/i,
      /WED96/i, /MED96/i, /WGD96/i, /MGD96/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_CCU_DRYER,
    label: 'Whirlpool / Maytag CCU/ACU dryer (gas)',
    manufacturers: ['Whirlpool', 'Maytag'],
    templateId: 'gas_dryer',
    modelPatterns: [
      /WED/i, /WGD/i, /MED/i, /MGD/i,
      /WED95/i, /MED95/i, /WGD95/i, /MGDB955/i,
      /WED96/i, /MED96/i, /WGD96/i, /MGD96/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_FREESTANDING_RANGE,
    label: 'Whirlpool/Maytag/KitchenAid/Kenmore/JennAir/IKEA/Amana freestanding range (electric)',
    manufacturers: ['Whirlpool', 'Maytag', 'Amana', 'KitchenAid', 'Kenmore', 'JennAir', 'IKEA'],
    templateId: 'electric_range',
    modelPatterns: [
      /WFE/i, /YWFE/i, /MER/i, /AER/i, /AES/i, /WEC/i, /WEE/i, /WFC/i,
      /4KWFE/i, /4KMER/i, /ACR/i, /YACR/i, /IES/i, /YIES/i,
      /KFE/i, /KFED/i, /KFG/i, /KFGG/i, /KFES/i, /KFEG/i, /YKFE/i,
      /JES/i, /JIS/i,
      /KSIB/i, /KSEB/i, /KSEG/i, /YKSE/i,
    ],
  },
  {
    id: PLATFORM_IDS.WHIRLPOOL_FREESTANDING_RANGE,
    label: 'Whirlpool/Maytag/KitchenAid/Kenmore/JennAir/IKEA/Amana freestanding range (gas)',
    manufacturers: ['Whirlpool', 'Maytag', 'Amana', 'KitchenAid', 'Kenmore', 'JennAir', 'IKEA'],
    templateId: 'gas_range',
    modelPatterns: [
      /WFG/i, /YWFG/i, /MGR/i, /AGR/i, /AGS/i, /WEG/i, /IGS/i, /YIGS/i,
      /4KWFG/i, /YIEL/i,
      /KFG/i, /KFGG/i, /KFGS/i, /KSEG/i,
      /JGS/i, /JDG/i,
      /KSGB/i, /KSGG/i, /KSEB/i, /KSEG/i, /YKSE/i,
    ],
  },
  {
    id: PLATFORM_IDS.GE_GUD27_STACKED,
    label: 'GE 24/27 in unitized stacked laundry (GUD27)',
    manufacturers: ['GE'],
    templateId: 'stacked_laundry',
    modelPatterns: [/GUD27/i],
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
  amana: 'Amana',
  kenmore: 'Kenmore',
  jennair: 'JennAir',
  ikea: 'IKEA',
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
