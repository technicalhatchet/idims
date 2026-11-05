/**
 * "Snap tag": read model / serial from one still photo taken with the iPhone's own camera.
 *
 * The native camera gives a full-resolution, focused, HDR photo, far sharper than a frame of
 * the live video, so the same barcode + text readers do much better on it. Because there's
 * only one image, it is read several ways (barcode, two text passes at different sizes,
 * zoomed reads of each MODEL / S/N line, and a sideways retry for vertical tags), and the
 * reads vote in a PlateReadTracker exactly like live frames do.
 */
import { fitCanvas, zoomLine } from './plateScanEngines';
import { findLabelWords, PlateReadTracker } from '../utils/plateParse';

const PHOTO_MAX = 3200; // long side kept for zoomed line reads (memory on older phones)
const BARCODE_MAX = 1800;
const TEXT_PASSES = [1400, 2000]; // reading-copy widths; the second runs only if needed
const LINE_MIN_CONFIDENCE = 40;

/** Decode a photo File into a canvas, upright (EXIF orientation applied), long side ≤ maxSide. */
export async function loadPhoto(file, maxSide = PHOTO_MAX) {
  let source;
  let release = () => {};
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
    release = () => source.close?.();
  } catch {
    // Older Safari: go through an <img>, which applies EXIF orientation itself.
    const url = URL.createObjectURL(file);
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not open that photo'));
      img.src = url;
    });
    release = () => URL.revokeObjectURL(url);
  }
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  release();
  return canvas;
}

/** A copy of src turned 90° (clockwise) or -90°. */
function rotated(src, deg) {
  const c = document.createElement('canvas');
  c.width = src.height;
  c.height = src.width;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/** JPEG of the photo for the job record (same size the live scanner saved). */
export function photoBlob(canvas, maxSide = 1600) {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob((b) => resolve(b || null), 'image/jpeg', 0.85));
}

/**
 * Read one photo.
 * @param {HTMLCanvasElement} photo  from loadPhoto
 * @param {{ barcode, ocr, make?: string, vertical?: boolean, seed?: string[],
 *           onStage?: (s: 'barcode'|'text'|'lines'|'turn') => void,
 *           onUpdate?: (snapshot) => void, cancelled?: () => boolean }} opts
 *   barcode: engine from createBarcodeEngine; ocr: engine from createOcrEngine (may be null);
 *   seed: labeled barcode values the live view already locked ("MODEL X", "SN Y")
 * @returns {Promise<{ snapshot, tracker }>}
 */
export async function readSnap(photo, { barcode, ocr, make = '', vertical = false, seed = [], onStage, onUpdate, cancelled = () => false }) {
  const tracker = new PlateReadTracker({ make });
  seed.forEach((code) => tracker.addBarcode(code));
  const update = () => onUpdate?.(tracker.snapshot());
  const done = () => tracker.snapshot().done;

  // Barcodes first: exact, and a match lets the text reads lock straight away.
  onStage?.('barcode');
  const small = document.createElement('canvas');
  const turns = vertical ? [-90, 0] : [0, -90];
  for (const deg of turns) {
    if (cancelled() || !barcode) break;
    const src = deg ? rotated(photo, deg) : photo;
    const c = fitCanvas(src, small, { maxWidth: BARCODE_MAX });
    try {
      const found = await barcode.decode(c);
      found.forEach((f) => tracker.addBarcode(f.text));
      update();
      if (found.length) break;
    } catch { /* keep going */ }
  }
  if (!ocr || done() || cancelled()) return { snapshot: tracker.snapshot(), tracker };

  // Text: upright first (or sideways first in VERT mode); turn the other way only when the
  // first direction found no labels at all.
  const orientations = vertical ? [-90, 90, 0] : [0, -90, 90];
  const read = document.createElement('canvas');
  const line = document.createElement('canvas');
  for (const deg of orientations) {
    if (cancelled()) break;
    if (deg !== orientations[0]) onStage?.('turn');
    const src = deg ? rotated(photo, deg) : photo;
    let sawLabel = false;
    for (const width of TEXT_PASSES) {
      if (cancelled() || done()) break;
      onStage?.('text');
      const c = fitCanvas(src, read, { maxWidth: width, enhance: true });
      let result;
      try {
        result = await ocr.read(c);
      } catch {
        continue;
      }
      if (cancelled()) break;
      tracker.addOcr(result.text);
      update();
      const labels = findLabelWords(result.words);
      if (labels.model.length || labels.serial.length) sawLabel = true;
      // Zoomed reads of the line next to each label: the sharpest reads we get.
      onStage?.('lines');
      for (const kind of ['model', 'serial']) {
        if (tracker.snapshot()[kind].locked) continue;
        for (const label of labels[kind].slice(0, 2)) {
          if (cancelled()) break;
          const z = zoomLine(src, c, label.bbox, line);
          if (!z) continue;
          try {
            const r = await ocr.readLine(z);
            if (r.confidence < LINE_MIN_CONFIDENCE) continue;
            tracker.addOcr(`${kind === 'serial' ? 'S/N' : 'MODEL'} ${r.text}`, { weight: 2 });
            update();
          } catch { /* next label */ }
        }
      }
      // Both fields have a value from this orientation: a bigger pass won't change the answer.
      const s = tracker.snapshot();
      if (s.model.value && s.serial.value) break;
    }
    const s = tracker.snapshot();
    if (sawLabel || (s.model.value && s.serial.value)) break;
  }
  return { snapshot: tracker.snapshot(), tracker };
}
