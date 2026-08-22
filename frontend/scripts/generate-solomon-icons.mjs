/**
 * Flatten Solomon source icon onto #0A0F1E and export PWA sizes.
 * iOS fills transparent PNG corners with white — source must be opaque.
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const src = path.join(publicDir, 'solomoniosnewer.png');
const bg = { r: 10, g: 15, b: 30 };

for (const size of [180, 192, 512]) {
  const out = path.join(publicDir, `solomonicon-${size}x${size}.png`);
  await sharp(src)
    .flatten({ background: bg })
    .resize(size, size, { fit: 'contain', background: bg })
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}
