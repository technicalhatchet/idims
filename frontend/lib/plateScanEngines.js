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

const BOX_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/.:# ';
const LINE_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';

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
    tessedit_char_whitelist: BOX_WHITELIST,
    preserve_interword_spaces: '1',
  });
  onProgress?.(1);
  return {
    /**
     * Full read of the guide box.
     * @returns {Promise<{ text: string, confidence: number, words: { text: string, bbox: {x0,y0,x1,y1} }[] }>}
     */
    async read(canvas) {
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const words = [];
      (data?.blocks || []).forEach((b) => b.paragraphs?.forEach((p) => p.lines?.forEach((l) => l.words?.forEach((w) => {
        if (w?.text && w.bbox) words.push({ text: w.text, bbox: w.bbox });
      }))));
      return { text: data?.text || '', confidence: Number(data?.confidence) || 0, words };
    },
    /**
     * Read one zoomed line (the "second look" next to a MODEL / S/N label).
     * Single-line mode with letters, digits and dashes only reads spaced-out plate fonts far
     * better than the sparse full-box pass.
     */
    async readLine(canvas) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: LINE_WHITELIST });
      try {
        const { data } = await worker.recognize(canvas);
        return { text: data?.text || '', confidence: Number(data?.confidence) || 0 };
      } finally {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: BOX_WHITELIST });
      }
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
 * readable: false for a canvas only ever drawn from (never getImageData), so it stays GPU-backed.
 */
export function grabRegion(video, rect, canvas, { maxWidth = 1100, enhance = false, rotate = 0, readable = true } = {}) {
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
  // Only canvases we read pixels from need the CPU-backed mode; the full-resolution grab
  // stays on the GPU so copying a 4K frame doesn't stall the page.
  const ctx = canvas.getContext('2d', readable ? { willReadFrequently: true } : undefined);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (turned) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(video, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
  }
  if (enhance) stretchContrast(ctx, canvas.width, canvas.height);
  return canvas;
}

/** Grayscale + stretch the contrast to the full range (in place). */
function stretchContrast(ctx, width, height) {
  const img = ctx.getImageData(0, 0, width, height);
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

/**
 * Shrink a full-resolution grab into the reading canvas (same frame, so word boxes found
 * in the small copy line up with the sharp original).
 */
export function fitCanvas(src, canvas, { maxWidth = 1000, enhance = false } = {}) {
  if (!src?.width || !src?.height) return null;
  const scale = Math.min(1, maxWidth / src.width);
  canvas.width = Math.max(1, Math.round(src.width * scale));
  canvas.height = Math.max(1, Math.round(src.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if (enhance) stretchContrast(ctx, canvas.width, canvas.height);
  return canvas;
}

const LINE_TEXT_PX = 32; // Tesseract reads best with text about this tall
const LINE_PAD_PX = 24; // and a white margin around it

/**
 * The "second look": crop the line just right of a label word (box in reading-canvas
 * pixels) out of the sharp full-resolution grab, scale it so the text is ~32 px tall, pad
 * it with white and boost contrast.
 */
export function zoomLine(full, readCanvas, bbox, canvas) {
  if (!full?.width || !readCanvas?.width || !bbox) return null;
  const k = full.width / readCanvas.width;
  const h = Math.max(6, (bbox.y1 - bbox.y0) * k);
  const left = Math.round(bbox.x1 * k + h * 0.4);
  const top = Math.max(0, Math.round(bbox.y0 * k - h * 0.45));
  const width = Math.min(full.width - left, Math.round(h * 16));
  const height = Math.min(full.height - top, Math.round(h * 1.9));
  if (width < h * 2 || height < h) return null;
  const s = Math.min(3, LINE_TEXT_PX / h);
  canvas.width = Math.round(width * s) + LINE_PAD_PX * 2;
  canvas.height = Math.round(height * s) + LINE_PAD_PX * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(full, left, top, width, height, LINE_PAD_PX, LINE_PAD_PX, Math.round(width * s), Math.round(height * s));
  stretchContrast(ctx, canvas.width, canvas.height);
  return canvas;
}
