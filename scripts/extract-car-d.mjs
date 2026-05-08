import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(
  path.join(__dirname, '../frontend/public/icons/technician-rail-car.svg'),
  'utf8',
);
const m = svg.match(/d="([^"]+)"/);
const d = m[1];
const out =
  `/**\n * Path from frontend/public/icons/technician-rail-car.svg — do not edit by hand;\n * regenerate with node scripts/extract-car-d.mjs\n */\nexport const TECHNICIAN_RAIL_CAR_PATH_D = ${JSON.stringify(d)};\n`;

const outPath = path.join(__dirname, '../frontend/constants/technicianRailCarPath.js');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  out,
  'utf8',
);
