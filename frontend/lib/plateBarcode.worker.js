/* eslint-disable no-restricted-globals */
/**
 * ZXing barcode decoding, off the main thread so the scanner's animations never stall.
 * In:  { id, buffer (RGBA ArrayBuffer), width, height }
 * Out: { id, found: [{ text, box? }] }
 */
import { decodeBarcodes } from './plateBarcodeCore';

self.onmessage = (e) => {
  const { id, buffer, width, height } = e.data || {};
  let found = [];
  try {
    found = decodeBarcodes(new Uint8ClampedArray(buffer), width, height);
  } catch {
    found = [];
  }
  self.postMessage({ id, found });
};
