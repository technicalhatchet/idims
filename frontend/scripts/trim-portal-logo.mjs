/**
 * One-off: crop transparent padding from atomic-portal-split-flat.png.
 * Run: node scripts/trim-portal-logo.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public', 'arportal-brand');
const source = path.join(publicDir, 'atomic-portal-split-flat.png');
const output = path.join(publicDir, 'atomic-portal-logo.png');

const meta = await sharp(source).metadata();
await sharp(source).trim().png().toFile(output);
const trimmed = await sharp(output).metadata();
console.log(`trim-portal-logo: ${meta.width}x${meta.height} -> ${trimmed.width}x${trimmed.height}`);
console.log(`wrote ${output}`);
