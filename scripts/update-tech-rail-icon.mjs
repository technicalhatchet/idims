/**
 * Reads frontend/public/icons/techicon.svg → frontend/constants/techIconRail.js
 * Run: node scripts/update-tech-rail-icon.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'frontend/public/icons/techicon.svg');
const svg = fs.readFileSync(src, 'utf8');

const dMatch = svg.match(/\bd="([^"]+)"/);
if (!dMatch) {
  console.error('No path d attribute in techicon.svg');
  process.exit(1);
}

let viewBox = (svg.match(/viewBox=["']([^"']+)["']/i) || [])[1];
if (!viewBox) {
  const w = (svg.match(/\bwidth=["']([^"']+)["']/i) || [])[1];
  const h = (svg.match(/\bheight=["']([^"']+)["']/i) || [])[1];
  viewBox = w && h ? `0 0 ${w} ${h}` : '0 0 24 24';
}

const vbParts = viewBox
  .trim()
  .split(/[\s,]+/)
  .map(Number)
  .filter((n) => !Number.isNaN(n));
let aspectNum = 1;
if (vbParts.length >= 4) {
  const vbW = vbParts[2];
  const vbH = vbParts[3];
  aspectNum = vbH > 0 ? vbW / vbH : 1;
}

const out = `/**
 * AUTO-GENERATED from frontend/public/icons/techicon.svg
 * Regenerate: node scripts/update-tech-rail-icon.mjs
 */
export const TECH_ICON_VIEWBOX = ${JSON.stringify(viewBox)};
export const TECH_ICON_PATH_D = ${JSON.stringify(dMatch[1])};
export const TECH_ICON_ASPECT = ${aspectNum};
`;

const outPath = path.join(root, 'frontend/constants/techIconRail.js');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', path.relative(root, outPath));
