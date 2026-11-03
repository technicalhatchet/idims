/**
 * ZXing decode on raw RGBA pixels. Shared by the barcode worker and the main-thread
 * fallback (used only if a Worker can't be started).
 */
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

const ZXING_FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.ITF,
  BarcodeFormat.EAN_13,
  BarcodeFormat.UPC_A,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
];

let reader = null;
function getReader() {
  if (!reader) {
    reader = new MultiFormatReader();
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
  }
  return reader;
}

function luminance(rgba, width, height) {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < lum.length; i += 4, j += 1) {
    lum[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  return lum;
}

function crop(lum, width, x, y, w, h) {
  if (x === 0 && w === width) return new Uint8ClampedArray(lum.subarray(y * width, (y + h) * width));
  const out = new Uint8ClampedArray(w * h);
  for (let r = 0; r < h; r += 1) out.set(lum.subarray((y + r) * width + x, (y + r) * width + x + w), r * w);
  return out;
}

/** Bilinear 2x upscale along x (bars only need horizontal resolution) and y. */
function upscale2(src, w, h) {
  const W = w * 2;
  const H = h * 2;
  const out = new Uint8ClampedArray(W * H);
  for (let Y = 0; Y < H; Y += 1) {
    const sy = Math.min(h - 1, Y >> 1);
    for (let X = 0; X < W; X += 1) {
      const fx = X / 2;
      const x0 = Math.min(w - 1, Math.floor(fx));
      const x1 = Math.min(w - 1, x0 + 1);
      const t = fx - x0;
      out[Y * W + X] = src[sy * w + x0] * (1 - t) + src[sy * w + x1] * t;
    }
  }
  return out;
}

function tryRegion(lum, width, x, y, w, h, { zoom = 1 } = {}) {
  const r = getReader();
  try {
    let pixels = crop(lum, width, x, y, w, h);
    let pw = w;
    let ph = h;
    if (zoom === 2) {
      pixels = upscale2(pixels, w, h);
      pw = w * 2;
      ph = h * 2;
    }
    const source = new RGBLuminanceSource(pixels, pw, ph);
    const result = r.decodeWithState(new BinaryBitmap(new HybridBinarizer(source)));
    const pts = result.getResultPoints() || [];
    const xs = pts.map((p) => p.getX());
    const ys = pts.map((p) => p.getY());
    const box = pts.length
      ? {
        x: x + Math.min(...xs) / zoom,
        y: y + Math.min(...ys) / zoom,
        w: Math.max(4, (Math.max(...xs) - Math.min(...xs)) / zoom),
        h: Math.max(1, (Math.max(...ys) - Math.min(...ys)) / zoom),
      }
      : undefined;
    return { text: result.getText(), box };
  } catch {
    return null; // nothing in this region
  } finally {
    r.reset();
  }
}

const BLOCK = 8;

/**
 * Cheap barcode finder: 1D bars give strong left-right contrast and almost no up-down
 * contrast. Mark 8px blocks like that, join neighbours, and return a padded box per
 * group. Dense codes next to text (Whirlpool dishwasher tags) only decode when ZXing is
 * handed a tight crop like this.
 */
export function findBarcodeBoxes(lum, width, height) {
  const bw = Math.floor(width / BLOCK);
  const bh = Math.floor(height / BLOCK);
  if (bw < 4 || bh < 2) return [];
  const mark = new Uint8Array(bw * bh);
  for (let by = 0; by < bh; by += 1) {
    for (let bx = 0; bx < bw; bx += 1) {
      let gx = 0;
      let gy = 0;
      const x0 = bx * BLOCK;
      const y0 = by * BLOCK;
      for (let yy = y0; yy < y0 + BLOCK; yy += 1) {
        const row = yy * width;
        for (let xx = x0; xx < x0 + BLOCK; xx += 1) {
          const v = lum[row + xx];
          if (xx + 1 < width) gx += Math.abs(lum[row + xx + 1] - v);
          if (yy + 1 < height) gy += Math.abs(lum[row + width + xx] - v);
        }
      }
      const n = BLOCK * BLOCK;
      if (gx / n >= 14 && gx >= gy * 2.2) mark[by * bw + bx] = 1;
    }
  }
  // Close small horizontal gaps (wide spaces inside a barcode).
  for (let by = 0; by < bh; by += 1) {
    let last = -1;
    for (let bx = 0; bx < bw; bx += 1) {
      if (!mark[by * bw + bx]) continue;
      if (last >= 0 && bx - last > 1 && bx - last <= 3) for (let k = last + 1; k < bx; k += 1) mark[by * bw + k] = 2;
      last = bx;
    }
  }
  // Connected groups.
  const seen = new Uint8Array(bw * bh);
  const boxes = [];
  const stack = [];
  for (let i = 0; i < mark.length; i += 1) {
    if (!mark[i] || seen[i]) continue;
    let minX = bw;
    let maxX = 0;
    let minY = bh;
    let maxY = 0;
    let count = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % bw;
      const y = (j - x) / bw;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const nb = [x > 0 ? j - 1 : -1, x < bw - 1 ? j + 1 : -1, y > 0 ? j - bw : -1, y < bh - 1 ? j + bw : -1];
      for (const k of nb) {
        if (k >= 0 && mark[k] && !seen[k]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    const gw = maxX - minX + 1;
    const gh = maxY - minY + 1;
    // A real 1D code is at least ~6 blocks long and wider than it is tall.
    if (gw >= 6 && gw >= gh * 1.2 && count >= 8) boxes.push({ minX, maxX, minY, maxY, count });
  }
  boxes.sort((p, q) => q.count - p.count);
  return boxes.slice(0, 4).map((g) => {
    const padX = Math.max(3, Math.round((g.maxX - g.minX + 1) * 0.12)); // quiet zone
    const x0 = Math.max(0, (g.minX - padX) * BLOCK);
    const x1 = Math.min(width, (g.maxX + 1 + padX) * BLOCK);
    const y0 = Math.max(0, (g.minY - 1) * BLOCK);
    const y1 = Math.min(height, (g.maxY + 2) * BLOCK);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });
}

/**
 * ZXing finds one code per pass. Plates often carry two (model + serial), so also scan
 * overlapping horizontal strips; busy plates confuse a full-frame pass, while a strip
 * around one barcode reads cleanly.
 */
export function decodeBarcodes(rgba, width, height) {
  const lum = luminance(rgba, width, height);
  const out = [];
  const add = (hit) => {
    if (hit && !out.some((o) => o.text === hit.text)) out.push(hit);
  };
  // 1) Tight crops around anything that looks like a barcode (fast, handles dense codes).
  //    Far-away codes have ~1px bars; a 2x retry of the small crop recovers them.
  for (const b of findBarcodeBoxes(lum, width, height)) {
    add(tryRegion(lum, width, b.x, b.y, b.w, b.h) || (b.w <= 900 ? tryRegion(lum, width, b.x, b.y, b.w, b.h, { zoom: 2 }) : null));
  }
  // Anything read from a tight crop: return now. The full-frame fallback below costs
  // ~1s on a phone, and the other field can still come from the next pass or the text.
  if (out.length) return out;
  // 2) Nothing found that way: full frame (also catches QR / Data Matrix), then overlapping horizontal strips.
  const regions = [[0, height]];
  const band = Math.round(height * 0.34);
  const step = Math.max(1, Math.round(height * 0.17));
  for (let y = 0; y + band <= height + 1; y += step) regions.push([y, Math.min(band, height - y)]);
  for (const [y, h] of regions) {
    if (h < 8) continue;
    add(tryRegion(lum, width, 0, y, width, h));
  }
  return out;
}
