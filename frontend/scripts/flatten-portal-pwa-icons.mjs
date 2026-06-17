/**
 * Bake client portal PWA icons onto the dashboard shell color (#0B0F1A).
 * iOS home-screen icons ignore manifest background_color; transparent PNGs show white.
 *
 * Usage: npm run pwa:icons:portal
 * Source: public/portalicon.png (or pass path as argv[2])
 */
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const BG = { r: 11, g: 15, b: 26, alpha: 1 }; // #0B0F1A
const source = process.argv[2] || path.join(publicDir, 'portalicon.png');

async function writeIcon(size) {
  const out = path.join(publicDir, `portalicon-${size}x${size}.png`);
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(out);
  console.log('Wrote', out);
}

await writeIcon(180);
await writeIcon(192);
await writeIcon(500);
