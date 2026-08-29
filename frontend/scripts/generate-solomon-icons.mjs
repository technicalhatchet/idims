/**
 * Flatten Solomon PWA hat icons onto #0A0F1E and export platform sizes.
 * iOS: ioshat.png — Android: androidhat.png
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const wizDir = path.join(publicDir, 'images', 'solomonwiz');
const bg = { r: 10, g: 15, b: 30 };

const targets = [
  { src: path.join(wizDir, 'ioshat.png'), outPrefix: 'solomonicon-ios', sizes: [180] },
  { src: path.join(wizDir, 'androidhat.png'), outPrefix: 'solomonicon-android', sizes: [192, 512] },
];

for (const { src, outPrefix, sizes } of targets) {
  for (const size of sizes) {
    const out = path.join(publicDir, `${outPrefix}-${size}x${size}.png`);
    await sharp(src)
      .flatten({ background: bg })
      .resize(size, size, { fit: 'contain', background: bg })
      .png()
      .toFile(out);
    console.log(`wrote ${out}`);
  }
}
