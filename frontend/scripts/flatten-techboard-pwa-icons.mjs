/**
 * Generate all idimsicon derivatives from public/idimsicon.png.
 *
 * - PWA (techboard shell #0A0F1E): idimsicon-180/192/512
 * - Main manifests (#ffffff): icon-192, icon-500, icon-64
 * - Favicons (transparent): favicon-16, favicon-32, favicon.ico
 * - Push notifications: icons/icon-192x192.png
 *
 * Usage: npm run pwa:icons:techboard
 * Source: public/idimsicon.png (or pass path as argv[2])
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');

const TECHBOARD_BG = { r: 10, g: 15, b: 30, alpha: 1 }; // #0A0F1E
const WHITE_BG = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const source = process.argv[2] || path.join(publicDir, 'idimsicon.png');

if (!fs.existsSync(source)) {
  console.error('Source icon not found:', source);
  process.exit(1);
}

async function writeSizedPng(size, outPath, background) {
  let pipeline = sharp(source).resize(size, size, {
    fit: 'contain',
    background,
  });
  if (background.alpha === 1) {
    pipeline = pipeline.flatten({ background });
  }
  await pipeline.png().toFile(outPath);
  console.log('Wrote', outPath);
}

async function writeFaviconIco() {
  const fav16 = path.join(publicDir, 'favicon-16x16.png');
  const fav32 = path.join(publicDir, 'favicon-32x32.png');
  const favIco = path.join(publicDir, 'favicon.ico');
  const ico = await toIco([fs.readFileSync(fav16), fs.readFileSync(fav32)]);
  fs.writeFileSync(favIco, ico);
  console.log('Wrote', favIco);
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Techboard PWA (dark shell)
for (const size of [180, 192, 512]) {
  await writeSizedPng(size, path.join(publicDir, `idimsicon-${size}x${size}.png`), TECHBOARD_BG);
}

// Root manifests (white background)
for (const size of [64, 192, 500]) {
  await writeSizedPng(size, path.join(publicDir, `icon-${size}x${size}.png`), WHITE_BG);
}

// Browser tab favicons (transparent)
for (const size of [16, 32]) {
  await writeSizedPng(size, path.join(publicDir, `favicon-${size}x${size}.png`), TRANSPARENT);
}

await writeSizedPng(192, path.join(iconsDir, 'icon-192x192.png'), WHITE_BG);

await writeFaviconIco();
