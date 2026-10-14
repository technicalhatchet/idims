import {
  DIAGNOSTIC_CREDIT_MARKETING,
  OPENING_SPECIAL_PRICE,
  SAME_DAY_DIAGNOSTICS_TAGLINE,
} from './bookingMarketing';

export const MARKETING_PHONE_DISPLAY = '(419) 740-0146';
export const MARKETING_PHONE_TEL = '4197400146';
export const MARKETING_EMAIL = 'service@atomicrepair419.com';

/** No fixed storefront hours — visits are scheduled case by case. */
export const MARKETING_SCHEDULING = {
  title: 'Scheduling',
  lines: [
    'By appointment — we are not a walk-in counter.',
    'Evenings and weekends are often possible when the schedule allows.',
    'Book online or call; we will confirm a time that works before we head out.',
  ],
};

export const MARKETING_COVERAGE_BLURB =
  'Toledo and Northwest Ohio — including Maumee, Perrysburg, Sylvania, Oregon, and nearby communities.';

export const MARKETING_DIAGNOSTIC_FAQ_ANSWER =
  `Diagnostic visits start at $${OPENING_SPECIAL_PRICE}. ${DIAGNOSTIC_CREDIT_MARKETING}`;

export const CITY_HERO_TRUST_POINTS = [
  'Upfront pricing after diagnosis',
  SAME_DAY_DIAGNOSTICS_TAGLINE,
  '90-day warranty on completed repairs',
];

export const MARKETING_TRUST_STRIP = [
  { label: 'Diagnostic fee', value: `$${OPENING_SPECIAL_PRICE}` },
  { label: 'Repair credit', value: '50% applied' },
  { label: 'Service area', value: 'NW Ohio' },
  { label: 'Scheduling', value: 'Call to confirm' },
];

export const OUR_PROMISE = {
  title: 'Our Promise',
  body:
    'Same-day diagnostics when available, upfront pricing, and a 90-day warranty on repairs we complete. '
    + 'Your diagnostic fee is not wasted — if you approve the repair, 50% of the diagnostic fee applies toward the repair. '
    + 'If a repair attempt is unsuccessful, you will not be charged labor for that repair.',
  bullets: [
    'Honest diagnosis before any repair work',
    'You approve the quote before we proceed',
    'Local, owner-operated service',
  ],
};

/** Canonical marketing service list — single source for homepage, footer, and city pages. */
export const MARKETING_SERVICES = [
  {
    title: 'Washer Repair',
    slug: 'washer-repair',
    equipmentType: 'washer',
    description: 'Drain, spin, leak, and control issues on top-load and front-load washers.',
    icon: '/applianceicons/neon/neonwasher.png',
  },
  {
    title: 'Dryer Repair',
    slug: 'dryer-repair',
    equipmentType: 'dryer',
    description: 'No heat, long dry times, noise, and drum problems on electric and gas dryers.',
    icon: '/applianceicons/neon/neondryer.png',
  },
  {
    title: 'Refrigerator Repair',
    slug: 'refrigerator-repair',
    equipmentType: 'refrigerator',
    description: 'Not cooling? Leaking? Noisy? We diagnose compressors, fans, seals, and controls.',
    icon: '/applianceicons/neon/neonfridge.png',
  },
  {
    title: 'Oven & Range Repair',
    slug: 'oven-repair',
    equipmentType: 'oven',
    description: 'Igniters, bake/broil elements, temperature problems, and control boards.',
    icon: '/applianceicons/neon/neonrange.png',
  },
  {
    title: 'Dishwasher Repair',
    slug: 'dishwasher-repair',
    equipmentType: 'dishwasher',
    description: 'Poor cleaning, draining problems, leaks, and error codes.',
    icon: '/applianceicons/neon/neondishwasher.png',
  },
  {
    title: 'Microwave Repair',
    slug: 'microwave-repair',
    equipmentType: 'microwave',
    description: 'No heat, turntable issues, and control failures on counter and OTR units.',
    icon: '/applianceicons/neon/neonmicrowave.png',
  },
  {
    title: 'Freezer Repair',
    slug: 'freezer-repair',
    equipmentType: 'refrigerator',
    description: 'Temperature swings, frost buildup, or failure to run — we troubleshoot stand-alone and built-in units.',
    icon: '/applianceicons/neon/neonfridge.png',
  },
  {
    title: 'TV Repair',
    slug: 'tv-repair',
    equipmentType: 'tv',
    description: 'No picture, power, backlight, and input issues on major TV brands.',
    icon: '/applianceicons/neon/neonorangecurvedtv.png',
  },
];

export const WHY_CHOOSE_US_HONEST = [
  {
    title: 'Owner-operated',
    description: 'You work directly with the person running the business — not a call center.',
  },
  {
    title: 'Diagnostic-first',
    description: 'We find the fault on-site and quote repair before additional work.',
  },
  {
    title: SAME_DAY_DIAGNOSTICS_TAGLINE,
    description: 'Request the earliest visit — we call to confirm availability.',
  },
  {
    title: 'Upfront pricing',
    description: 'Clear quote after diagnosis. No surprise add-ons.',
  },
  {
    title: '90-day warranty',
    description: 'Parts and labor warranty on repairs we complete.',
  },
];
