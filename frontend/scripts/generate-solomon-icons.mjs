/**
 * Generate Solomon PWA icons from the black-glass master artwork.
 *
 * The source is already a square icon with the cyan/orange border baked in —
 * resize with cover so that border fills the canvas edge-to-edge.
 *
 * Usage: npm run pwa:icons:solomon
 * Source: public/images/solomonwiz/solomonblackglass.png
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const source = path.join(publicDir, 'images', 'solomonwiz', 'solomonblackglass.png');

const SOLOMON_BG = { r: 10, g: 15, b: 30, alpha: 1 }; // #0A0F1E

const targets = [
  { outPrefix: 'solomonicon-ios', sizes: [180] },
  { outPrefix: 'solomonicon-android', sizes: [192, 512] },
];

if (!fs.existsSync(source)) {
  console.error('Source icon not found:', source);
  process.exit(1);
}

async function writeIcon(size, outPath) {
  await sharp(source)
    .resize(size, size, {
      fit: 'cover',
      position: 'centre',
    })
    .flatten({ background: SOLOMON_BG })
    .png()
    .toFile(outPath);

  console.log('Wrote', outPath);
}

for (const { outPrefix, sizes } of targets) {
  for (const size of sizes) {
    const out = path.join(publicDir, `${outPrefix}-${size}x${size}.png`);
    await writeIcon(size, out);
  }
}
