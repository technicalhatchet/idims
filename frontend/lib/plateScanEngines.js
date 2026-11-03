/**
 * Barcode + OCR engines for the plate scanner. Both run entirely on the phone.
 *  - Barcodes: the browser's built-in BarcodeDetector when it has one (Android Chrome),
 *    otherwise ZXing (iPhone Safari has no built-in detector).
 *  - Text: Tesseract, loaded lazily from /vendor/tesseract (self-hosted, see
 *    scripts/copy-scanner-assets.mjs) so it works offline once cached.
 */
const NATIVE_FORMATS = ['code_128', 'code_39', 'code_93', 'codabar', 'itf', 'ean_13', 'upc_a', 'qr_code', 'data_matrix'];

/** @returns {{ decode(canvas: HTMLCanvasElement): Promise<{ text: string, box?: {x,y,w,h} }[]>, close(): void, kind: string }} */
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
          close() {},
        };
      }
    } catch {
      // fall through to ZXing
    }
  }

  return createZxingEngine();
}

/**
 * ZXing runs in a Web Worker so its decode passes (tens to hundreds of ms on a phone)
 * never block the main thread, which is what keeps the scan bar and HUD animating.
 */
function createZxingEngine() {
  let worker = null;
  try {
    worker = new Worker(new URL('./plateBarcode.worker.js', import.meta.url));
  } catch {
    worker = null;
  }
  if (!worker) {
    // No worker support: decode inline (old behaviour).
    return {
      kind: 'zxing',
      async decode(canvas) {
        const { decodeBarcodes } = await import('./plateBarcodeCore');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return decodeBarcodes(img.data, canvas.width, canvas.height);
      },
      close() {},
    };
  }
  let seq = 0;
  const waiting = new Map();
  worker.onmessage = (e) => {
    const { id, found } = e.data || {};
    const done = waiting.get(id);
    if (done) {
      waiting.delete(id);
      done(found || []);
    }
  };
  worker.onerror = () => {
    waiting.forEach((done) => done([]));
    waiting.clear();
  };
  return {
    kind: 'zxing',
    decode(canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const { width, height } = canvas;
      const img = ctx.getImageData(0, 0, width, height);
      seq += 1;
      const id = seq;
      return new Promise((resolve) => {
        waiting.set(id, resolve);
        worker.postMessage({ id, buffer: img.data.buffer, width, height }, [img.data.buffer]);
      });
    },
    close() {
      worker.terminate();
      waiting.forEach((done) => done([]));
      waiting.clear();
    },
  };
}

/**
 * Lazily creates the Tesseract worker.
 * @param {(p: number) => void} onProgress  0..1 while the engine/model download
 * @returns {Promise<{ read(canvas: HTMLCanvasElement): Promise<{ text: string, confidence: number }>, close(): Promise<void> }>}
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
    /** @returns {Promise<{ text: string, confidence: number }>} confidence 0..100 */
    async read(canvas) {
      const { data } = await worker.recognize(canvas);
      return { text: data?.text || '', confidence: Number(data?.confidence) || 0 };
    },
    async close() {
      await worker.terminate();
    },
  };
}

/**
 * Copy the guide-box region of the video into a canvas, sized for decoding.
 * For OCR the image is also grayscaled and contrast-stretched.
 * rotate: 0, 90 (clockwise) or -90 — turns a sideways plate upright for the readers.
 * maxWidth applies to the long side of the plate text (the source height when rotated).
 */
export function grabRegion(video, rect, canvas, { maxWidth = 1100, enhance = false, rotate = 0 } = {}) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const sx = Math.max(0, Math.round(rect.x * vw));
  const sy = Math.max(0, Math.round(rect.y * vh));
  const sw = Math.min(vw - sx, Math.round(rect.w * vw));
  const sh = Math.min(vh - sy, Math.round(rect.h * vh));
  const turned = rotate === 90 || rotate === -90;
  const scale = Math.min(1, maxWidth / (turned ? sh : sw));
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  canvas.width = turned ? dh : dw;
  canvas.height = turned ? dw : dh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (turned) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(video, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
  }
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
