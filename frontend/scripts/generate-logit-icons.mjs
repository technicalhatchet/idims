/**
 * Generate LoGiT PWA icons from the iOS master artwork.
 *
 * Uses cover + shell background so the icon fills edge-to-edge without
 * iOS adding white/black letterboxing from transparent or maskable padding.
 *
 * Usage: npm run pwa:icons:logit
 * Source: public/logitios.png
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const source = path.join(publicDir, 'logitios.png');

const LOGIT_BG = { r: 10, g: 15, b: 30, alpha: 1 }; // #0A0F1E

const targets = [
  { outPrefix: 'logiticon-ios', sizes: [180] },
  { outPrefix: 'logiticon-android', sizes: [192, 512] },
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
    .flatten({ background: LOGIT_BG })
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
