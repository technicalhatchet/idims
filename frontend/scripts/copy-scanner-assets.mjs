/**
 * Copies the plate scanner's OCR engine files out of node_modules into
 * public/vendor/tesseract so they're served from our own domain (works offline
 * once cached, no third-party CDN). Runs automatically before dev and build.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'vendor', 'tesseract');
const nm = (...p) => join(root, 'node_modules', ...p);

const files = [
  [nm('tesseract.js', 'dist', 'worker.min.js'), 'worker.min.js'],
  // LSTM-only cores (smaller); tesseract.js picks the SIMD one when the phone supports it.
  [nm('tesseract.js-core', 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [nm('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  // English model, "best_int" build: accurate and ~3 MB.
  [nm('@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
];

mkdirSync(out, { recursive: true });
let copied = 0;
for (const [src, name] of files) {
  if (!existsSync(src)) {
    console.warn(`[scanner-assets] missing ${src} — run npm install`);
    continue;
  }
  const dest = join(out, name);
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
  copyFileSync(src, dest);
  copied += 1;
}
console.log(`[scanner-assets] ${copied ? `copied ${copied} file(s)` : 'up to date'} → public/vendor/tesseract`);
