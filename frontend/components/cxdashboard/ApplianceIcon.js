/**
 * ApplianceIcon — thin 1.5 stroke neon SVG icons for appliances
 * Usage: <ApplianceIcon type="refrigerator" className="w-8 h-8" />
 */

const ICONS = {
  refrigerator: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2"/>
      <line x1="6" y1="10" x2="18" y2="10"/>
      <line x1="10" y1="5" x2="10" y2="8"/>
      <line x1="10" y1="13" x2="10" y2="16"/>
    </>
  ),
  washer: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <circle cx="12" cy="13" r="5"/>
      <circle cx="12" cy="13" r="2"/>
      <circle cx="8" cy="6" r="1"/>
    </>
  ),
  dryer: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <circle cx="12" cy="13" r="5"/>
      <path d="M10 11a2 2 0 0 0 4 0"/>
      <circle cx="8" cy="6" r="1"/>
    </>
  ),
  oven: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <rect x="6" y="10" width="12" height="9" rx="1"/>
      <line x1="7" y1="6" x2="7" y2="6"/>
      <line x1="10" y1="6" x2="10" y2="6"/>
      <line x1="13" y1="6" x2="13" y2="6"/>
      <line x1="16" y1="6" x2="16" y2="6"/>
    </>
  ),
  range: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <rect x="6" y="10" width="12" height="9" rx="1"/>
      <line x1="7" y1="6" x2="7" y2="6"/>
      <line x1="10" y1="6" x2="10" y2="6"/>
      <line x1="13" y1="6" x2="13" y2="6"/>
      <line x1="16" y1="6" x2="16" y2="6"/>
    </>
  ),
  dishwasher: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="4" y1="8" x2="20" y2="8"/>
      <line x1="9" y1="5" x2="15" y2="5"/>
    </>
  ),
  microwave: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <rect x="4" y="8" width="12" height="8"/>
      <line x1="18" y1="10" x2="18" y2="10"/>
      <line x1="18" y1="12" x2="18" y2="12"/>
      <line x1="18" y1="14" x2="18" y2="14"/>
    </>
  ),
  freezer: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="12" y1="6" x2="12" y2="10"/>
    </>
  ),
  tv: (
    <>
      <rect x="2" y="4" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="18" x2="12" y2="21"/>
    </>
  ),
  // Fallback for unknown appliances
  appliance: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="8" x2="16" y2="8"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="8" y1="16" x2="12" y2="16"/>
    </>
  ),
};

// Normalize subtype strings to icon keys
function normalizeType(type) {
  if (!type) return 'appliance';
  const t = type.toLowerCase().trim();
  if (t.includes('fridge') || t.includes('refrigerator')) return 'refrigerator';
  if (t.includes('wash')) return 'washer';
  if (t.includes('dry')) return 'dryer';
  if (t.includes('dishwash')) return 'dishwasher';
  if (t.includes('micro')) return 'microwave';
  if (t.includes('oven')) return 'oven';
  if (t.includes('range') || t.includes('stove') || t.includes('cooktop')) return 'range';
  if (t.includes('freez')) return 'freezer';
  if (t.includes('tv') || t.includes('television')) return 'tv';
  return 'appliance';
}

export default function ApplianceIcon({ type, className = 'w-8 h-8', color = 'cyan' }) {
  const key = normalizeType(type);
  const paths = ICONS[key] || ICONS.appliance;

  const ORANGE_TYPES = ['oven', 'range', 'microwave', 'dryer', 'tv'];
const isOrange = color === 'orange' || ORANGE_TYPES.includes(key);

const strokeColor = isOrange ? '#FF7A00' : '#00D4FF';
const glowColor = isOrange
  ? 'rgba(255, 122, 0, 0.6)'
  : 'rgba(0, 212, 255, 0.6)';

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={{
        stroke: strokeColor,
        strokeWidth: 1.5,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        filter: `drop-shadow(0 0 6px ${glowColor})`,
      }}
    >
      {paths}
    </svg>
  );
}
