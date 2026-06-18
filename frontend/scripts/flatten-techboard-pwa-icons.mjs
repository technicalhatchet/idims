/**
 * Bake PWA icons onto the techboard shell color (#0A0F1E).
 * iOS home-screen icons ignore manifest background_color; transparent PNGs show white.
 *
 * Usage: npm run pwa:icons:techboard
 * Source: public/idimsicon.png (or pass path as argv[2])
 */
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const BG = { r: 10, g: 15, b: 30, alpha: 1 }; // #0A0F1E
const source = process.argv[2] || path.join(publicDir, 'idimsicon.png');

async function writeIcon(size) {
  const out = path.join(publicDir, `idimsicon-${size}x${size}.png`);
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(out);
  console.log('Wrote', out);
}

await writeIcon(180);
await writeIcon(192);
await writeIcon(512);
