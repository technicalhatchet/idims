/**
 * Regenerate optimized logo assets from public/arpano.png (master).
 * Run: node scripts/optimize-atomic-logo.mjs
 */
import sharp from 'sharp';
import fs from 'fs';

const source = 'public/arpano.png';

async function main() {
  const meta = await sharp(source).metadata();
  const origBytes = fs.statSync(source).size;
  console.log(`Source ${source}: ${meta.width}x${meta.height}, ${origBytes} bytes`);

  await sharp(source).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 88 }).toFile('public/arpano-800.webp');
  await sharp(source).resize({ width: 800, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true }).toFile('public/arpano-800.png');
  await sharp(source).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 88 }).toFile('public/arpano-400.webp');

  for (const file of ['public/arpano-800.webp', 'public/arpano-800.png', 'public/arpano-400.webp']) {
    const s = fs.statSync(file);
    const m = await sharp(file).metadata();
    console.log(`${file}: ${m.width}x${m.height}, ${s.size} bytes`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
