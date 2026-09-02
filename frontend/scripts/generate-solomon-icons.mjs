/**
 * Generate Solomon PWA icons from the black-glass master artwork.
 *
 * iOS home-screen icons use a squircle mask — inset the artwork so the glowing
 * border is not clipped. Android sizes use a slightly tighter crop.
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
  { outPrefix: 'solomonicon-ios', sizes: [180], inset: 0.07 },
  { outPrefix: 'solomonicon-android', sizes: [192, 512], inset: 0.045 },
];

if (!fs.existsSync(source)) {
  console.error('Source icon not found:', source);
  process.exit(1);
}

async function writeIcon(size, outPath, inset) {
  const inner = Math.round(size * (1 - inset * 2));
  const offset = Math.round((size - inner) / 2);

  const artwork = await sharp(source)
    .resize(inner, inner, {
      fit: 'contain',
      background: SOLOMON_BG,
    })
    .flatten({ background: SOLOMON_BG })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: SOLOMON_BG,
    },
  })
    .composite([{ input: artwork, left: offset, top: offset }])
    .png()
    .toFile(outPath);

  console.log('Wrote', outPath, `(inset ${(inset * 100).toFixed(1)}%)`);
}

for (const { outPrefix, sizes, inset } of targets) {
  for (const size of sizes) {
    const out = path.join(publicDir, `${outPrefix}-${size}x${size}.png`);
    await writeIcon(size, out, inset);
  }
}
