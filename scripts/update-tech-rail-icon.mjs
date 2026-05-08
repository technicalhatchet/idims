/**
 * Reads frontend/public/icons/techiconbold.svg (fallback: techicon.svg) → frontend/constants/techIconRail.js
 * Run: node scripts/update-tech-rail-icon.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const techiconBoldPath = path.join(root, 'frontend/public/icons/techiconbold.svg');
const techiconPath = path.join(root, 'frontend/public/icons/techicon.svg');

function getViewBox(svg) {
  let viewBox = (svg.match(/viewBox=["']([^"']+)["']/i) || [])[1];
  if (!viewBox) {
    const w = (svg.match(/\bwidth=["']([^"']+)["']/i) || [])[1];
    const h = (svg.match(/\bheight=["']([^"']+)["']/i) || [])[1];
    viewBox = w && h ? `0 0 ${w} ${h}` : '0 0 24 24';
  }
  return viewBox;
}

function extractPathParts(svg) {
  const parts = [];
  for (const m of svg.matchAll(/<path\s+([^>]+)>/gi)) {
    const attrs = m[1];
    const dM =
      attrs.match(/\bd\s*=\s*"([^"]*)"/i) || attrs.match(/\bd\s*=\s*'([^']*)'/i);
    const dRaw = dM ? String(dM[1]).trim() : '';
    if (!dRaw) continue;
    const ruleM =
      attrs.match(/\bfill-rule\s*=\s*"([^"]+)"/i) ||
      attrs.match(/\bfill-rule\s*=\s*'([^']+)'/i);
    const fillRule =
      ruleM && ruleM[1] ? ruleM[1].trim().toLowerCase() : 'nonzero';
    const transformM =
      attrs.match(/\btransform\s*=\s*"([^"]+)"/i) ||
      attrs.match(/\btransform\s*=\s*'([^']+)'/i);
    const transform = transformM ? transformM[1].trim() : undefined;
    const entry = { d: dRaw, fillRule };
    if (transform) entry.transform = transform;
    parts.push(entry);
  }
  return parts;
}

function aspectFromViewBox(viewBox) {
  const vbParts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  if (vbParts.length >= 4) {
    const vbW = vbParts[2];
    const vbH = vbParts[3];
    return vbH > 0 ? vbW / vbH : 1;
  }
  return 1;
}

let svgUsed = fs.readFileSync(techiconBoldPath, 'utf8');
let pathParts = extractPathParts(svgUsed);

if (pathParts.length === 0) {
  console.warn(
    '[update-tech-rail-icon] techiconbold.svg has no path geometry — using techicon.svg until bold is exported with real paths.',
  );
  svgUsed = fs.readFileSync(techiconPath, 'utf8');
  pathParts = extractPathParts(svgUsed);
}

if (pathParts.length === 0) {
  console.error('No usable <path d="…"> found in techiconbold.svg or techicon.svg');
  process.exit(1);
}

const viewBox = getViewBox(svgUsed);
const aspectNum = aspectFromViewBox(viewBox);

const out = `/**
 * AUTO-GENERATED — prefers frontend/public/icons/techiconbold.svg (falls back to techicon.svg if bold has empty paths).
 * Regenerate: node scripts/update-tech-rail-icon.mjs
 */
export const TECH_ICON_VIEWBOX = ${JSON.stringify(viewBox)};
export const TECH_ICON_ASPECT = ${aspectNum};
export const TECH_ICON_PARTS = ${JSON.stringify(pathParts, null, 2)};
`;

const outPath = path.join(root, 'frontend/constants/techIconRail.js');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', path.relative(root, outPath), `(${pathParts.length} path(s), viewBox ${viewBox})`);
