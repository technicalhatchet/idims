/**
 * Barcode + OCR engines for the plate scanner. Both run entirely on the phone.
 *  - Barcodes: the browser's built-in BarcodeDetector when it has one (Android Chrome),
 *    otherwise ZXing (iPhone Safari has no built-in detector).
 *  - Text: Tesseract, loaded lazily from /vendor/tesseract (self-hosted, see
 *    scripts/copy-scanner-assets.mjs) so it works offline once cached.
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
const NATIVE_FORMATS = ['code_128', 'code_39', 'code_93', 'codabar', 'itf', 'ean_13', 'upc_a', 'qr_code', 'data_matrix'];

function toLuminance(ctx, x, y, w, h) {
  const { data } = ctx.getImageData(x, y, w, h);
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    lum[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return lum;
}

/** @returns {{ decode(canvas: HTMLCanvasElement): Promise<{ text: string, box?: {x,y,w,h} }[]>, kind: string }} */
export async function createBarcodeEngine() {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length) {
        const detector = new window.BarcodeDetector({ formats });
        return {
          kind: 'native',
          async decode(canvas) {
            const found = await detector.detect(canvas);
            return found
              .filter((b) => b.rawValue)
              .map((b) => ({
                text: b.rawValue,
                box: b.boundingBox && { x: b.boundingBox.x, y: b.boundingBox.y, w: b.boundingBox.width, h: b.boundingBox.height },
              }));
          },
        };
      }
    } catch {
      // fall through to ZXing
    }
  }

  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  const tryRegion = (ctx, x, y, w, h) => {
    try {
      const source = new RGBLuminanceSource(toLuminance(ctx, x, y, w, h), w, h);
      const result = reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(source)));
      const pts = result.getResultPoints() || [];
      const xs = pts.map((p) => p.getX());
      const ys = pts.map((p) => p.getY());
      const box = pts.length
        ? { x: x + Math.min(...xs), y: y + Math.min(...ys), w: Math.max(4, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys)) }
        : undefined;
      return { text: result.getText(), box };
    } catch {
      return null; // NotFoundException etc. — nothing in this region
    } finally {
      reader.reset();
    }
  };

  return {
    kind: 'zxing',
    async decode(canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const { width: w, height: h } = canvas;
      // ZXing finds one code per pass. Plates often carry two (model + serial),
      // so also scan overlapping horizontal strips; busy plates (text, borders) confuse
      // a full-frame pass, while a strip around one barcode reads cleanly.
      const regions = [[0, 0, w, h]];
      const band = Math.round(h * 0.34);
      const step = Math.round(h * 0.17);
      for (let y = 0; y + band <= h + 1; y += step) regions.push([0, y, w, Math.min(band, h - y)]);
      const out = [];
      for (const r of regions) {
        const hit = tryRegion(ctx, ...r);
        if (hit && !out.some((o) => o.text === hit.text)) out.push(hit);
      }
      return out;
    },
  };
}

/**
 * Lazily creates the Tesseract worker.
 * @param {(p: number) => void} onProgress  0..1 while the engine/model download
 * @returns {Promise<{ read(canvas: HTMLCanvasElement): Promise<string>, close(): Promise<void> }>}
 */
export async function createOcrEngine(onProgress) {
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: '/vendor/tesseract/worker.min.js',
    corePath: '/vendor/tesseract/',
    langPath: '/vendor/tesseract/',
    gzip: true,
    logger: (m) => {
      if (typeof m?.progress === 'number' && /load|initializ/i.test(m.status || '')) onProgress?.(m.progress);
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/.:# ',
    preserve_interword_spaces: '1',
  });
  onProgress?.(1);
  return {
    async read(canvas) {
      const { data } = await worker.recognize(canvas);
      return data?.text || '';
    },
    async close() {
      await worker.terminate();
    },
  };
}

/**
 * Copy the guide-box region of the video into a canvas, sized for decoding.
 * For OCR the image is also grayscaled and contrast-stretched.
 */
export function grabRegion(video, rect, canvas, { maxWidth = 1100, enhance = false } = {}) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const sx = Math.max(0, Math.round(rect.x * vw));
  const sy = Math.max(0, Math.round(rect.y * vh));
  const sw = Math.min(vw - sx, Math.round(rect.w * vw));
  const sh = Math.min(vh - sy, Math.round(rect.h * vh));
  const scale = Math.min(1, maxWidth / sw);
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (enhance) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      d[i] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = ((d[i] - lo) / span) * 255;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }
  return canvas;
}
