/* eslint-disable @next/next/no-img-element -- SVGs: next/image adds nothing and would strip their animation */
import React from 'react';
import { getEquipmentIconKey } from '../../utils/equipment-icon-key';

/**
 * Atomic Repair neon appliance icons (SVG files in /public/icons/appliances).
 *
 * Tiers
 *   small  — bold, simplified; for 16–48px (lists, tables, rows, IDIMS, client portal)
 *   detail — full detail; for 56px and up (marketing cards, booking, heroes)
 *
 * Motion (detail tier only; small is always static)
 *   static — never animates
 *   hover  — animates while hovered / focused (also when inside a hovered `.group`, link or button)
 *   active — animates on hover AND while `active` is true (e.g. a selected booking tile)
 *   always — always animates (service-page hero)
 * Visitors with "reduce motion" turned on always get the static version.
 */

const BASE = '/icons/appliances';

export const ATOMIC_ICON_NAMES = [
  'french-door-fridge', 'side-by-side-fridge', 'upright-freezer', 'chest-freezer',
  'washer', 'dryer', 'washer-dryer-combo', 'tall-combo', 'range', 'cooktop',
  'dishwasher', 'microwave', 'tv', 'other',
];

const LABELS = {
  'french-door-fridge': 'Refrigerator', 'side-by-side-fridge': 'Refrigerator',
  'upright-freezer': 'Freezer', 'chest-freezer': 'Freezer', washer: 'Washer', dryer: 'Dryer',
  'washer-dryer-combo': 'Washer dryer combo', 'tall-combo': 'All-in-one washer dryer',
  range: 'Oven and range', cooktop: 'Cooktop', dishwasher: 'Dishwasher', microwave: 'Microwave',
  tv: 'TV', other: 'Appliance',
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/** Map IDIMS equipment type/subtype strings (or a booking id like "aiolaundry") to an icon file name. */
export function resolveAtomicIconName(equipmentType, equipmentSubtype) {
  const raw = `${norm(equipmentType)} ${norm(equipmentSubtype)}`;
  const key = getEquipmentIconKey(equipmentType, equipmentSubtype);
  switch (key) {
    case 'refrigerator':
    case 'fridge':
      return raw.includes('side') ? 'side-by-side-fridge' : 'french-door-fridge';
    case 'freezer':
      return raw.includes('upright') || raw.includes('standalon') ? 'upright-freezer' : 'chest-freezer';
    case 'washer':
    case 'washingmachine':
      return 'washer';
    case 'dryer':
      return 'dryer';
    case 'aiolaundry':
      return 'tall-combo';
    case 'oven':
    case 'range':
      return 'range';
    case 'cooktop':
      return 'cooktop';
    case 'dishwasher':
      return 'dishwasher';
    case 'microwave':
      return 'microwave';
    case 'tv':
      return 'tv';
    default:
      return 'other';
  }
}

/** Pick a tier from a Tailwind size class: 56px (w-14) and up gets the detail set, smaller gets the small set. */
export function tierForClassName(className = '') {
  const sizes = [...String(className).matchAll(/(?:^|\s)(?:[a-z]+:)?w-(\d+)(?=\s|$)/g)].map((m) => Number(m[1]));
  const largest = sizes.length ? Math.max(...sizes) : 0;
  return largest >= 14 ? 'detail' : 'small';
}

export function atomicIconSrc(name, tier = 'detail', animated = false) {
  const folder = tier === 'small' ? 'small' : animated ? 'detail-animated' : 'detail-static';
  return `${BASE}/${folder}/${name}.svg`;
}

export default function AtomicIcon({
  equipmentType,
  equipmentSubtype,
  name,
  tier = 'detail',
  motion = 'static',
  active = false,
  className = 'w-16 h-16',
  label,
  decorative = false,
  priority = false,
}) {
  const icon = name && ATOMIC_ICON_NAMES.includes(name) ? name : resolveAtomicIconName(equipmentType || name, equipmentSubtype);
  const alt = decorative ? '' : label || LABELS[icon];
  const a11y = decorative ? { 'aria-hidden': true } : {};
  const loading = priority ? 'eager' : 'lazy';
  const staticSrc = atomicIconSrc(icon, tier, false);

  if (tier === 'small' || motion === 'static') {
    return (
      <img src={staticSrc} alt={alt} {...a11y} className={`inline-block object-contain ${className}`} loading={loading} draggable={false} />
    );
  }

  const liveSrc = atomicIconSrc(icon, 'detail', true);

  if (motion === 'always') {
    return (
      <picture className={`inline-block ${className}`}>
        <source media="(prefers-reduced-motion: reduce)" srcSet={staticSrc} />
        <img src={liveSrc} alt={alt} {...a11y} className="w-full h-full object-contain" loading={loading} draggable={false} />
      </picture>
    );
  }

  return (
    <span
      className={`atomic-icon atomic-icon--${motion}${active ? ' is-active' : ''} ${className}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? true : undefined}
    >
      <img src={staticSrc} alt="" className="atomic-icon__still" loading={loading} draggable={false} />
      <img src={liveSrc} alt="" className="atomic-icon__live" loading="lazy" draggable={false} />
    </span>
  );
}
