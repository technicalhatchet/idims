/**
 * Turns raw barcode / OCR text from an appliance rating plate into a model and serial.
 * Pure functions + a small tracker so the live scanner can decide when a value is "locked".
 */

const MODEL_LABEL = /(?:^|[^A-Z])(?:M[O0]D(?:E[LI1])?|MDL|M\/N|MN)\s*(?:N[O0]\.?|#|NUMBER|NUM)?\s*[:.#\-]?\s*/;
const SERIAL_LABEL = /(?:^|[^A-Z])(?:SER(?:[I1lL]A[LI1])?|S\/N|SN|SR)\s*(?:N[O0]\.?|#|NUMBER|NUM)?\s*[:.#\-]?\s*/;
const VALUE = /[A-Z0-9][A-Z0-9\-\/\.]{3,24}/;

function clean(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[‐-―]/g, '-')
    .replace(/^[\s:.#\-]+|[\s:.#\-\/]+$/g, '')
    .replace(/\s+/g, '');
}

/** "S/N: AB1234567" → { label: 'serial', value: 'AB1234567' } */
export function stripLabel(raw) {
  const text = String(raw || '').toUpperCase().trim();
  const m = text.match(/^(MODEL|MOD|MDL|M\/N|MN)\b\s*(?:NO\.?|#|NUMBER)?\s*[:.#\-]?\s*(.+)$/)
    || text.match(/^(SERIAL|SER|S\/N|SN)\b\s*(?:NO\.?|#|NUMBER)?\s*[:.#\-]?\s*(.+)$/);
  if (!m) return { label: null, value: clean(text) };
  const label = /^(MODEL|MOD|MDL|M\/N|MN)$/.test(m[1]) ? 'model' : 'serial';
  return { label, value: clean(m[2]) };
}

function trailingDigitRun(v) {
  const m = v.match(/(\d+)$/);
  return m ? m[1].length : 0;
}

function letterDigitGroups(v) {
  return (v.replace(/[^A-Z0-9]/g, '').match(/[A-Z]+|\d+/g) || []).length;
}

/**
 * Guess whether an unlabeled code is a model or a serial.
 * @returns {{ kind: 'model'|'serial'|null, score: number }} score > 0 leans model, < 0 leans serial.
 */
export function classifyCode(raw, { make = '' } = {}) {
  const v = clean(raw);
  if (v.length < 5 || v.length > 25) return { kind: null, score: 0 };
  const brand = String(make || '').toLowerCase();
  const digits = (v.match(/\d/g) || []).length;
  const letters = (v.match(/[A-Z]/g) || []).length;
  if (!digits) return { kind: null, score: 0 };

  if (/^\d{3}\.\d{4,}/.test(v)) return { kind: 'model', score: 5 }; // Kenmore models: 110.20222011

  let score = 0;
  if (/[\/]/.test(v)) score += 3; // Samsung/LG models: DV42H5000EW/A3
  if (/[A-Z]{1,4}$/.test(v)) score += 2; // models usually end in a color/variant code
  if (/\d[A-Z]{1,3}\d$/.test(v)) score += 2; // ...or a color code + revision digit: WFW5620HW0
  if (letterDigitGroups(v) >= 4) score += 1;
  const tail = trailingDigitRun(v);
  if (tail >= 5) score -= 3; // serials end in a long counter
  if (/^[A-Z]{1,3}\d{5,}$/.test(v)) score -= 3; // GE / Whirlpool / Frigidaire style serials
  if (/^\d{3}[A-Z]{2,4}\d{4,}$/.test(v)) score -= 3; // LG serial: 912KWZD12345
  if (v.length >= 14 && v.length <= 16 && !/[\/\.\-]/.test(v) && digits >= 6) score -= 2; // Samsung serial
  if (brand.includes('samsung') && v.length === 15 && /^[0-9A-Z]{15}$/.test(v)) score -= 3;
  if (digits / v.length > 0.8) score -= 1;
  if (letters === 0 && v.length >= 8) score -= 1;

  if (score >= 2) return { kind: 'model', score };
  if (score <= -2) return { kind: 'serial', score };
  return { kind: null, score };
}

function valueAfter(text, labelRe) {
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(labelRe);
    if (!m) continue;
    // OCR often splits a value with single spaces ("C3 4512045"); rejoin those.
    // Only a short leading fragment is rejoined, so "WFW5620HW0 120V" stays two things.
    const join = (s) => {
      const t = String(s || '').trim().split(/\s+/);
      if (t.length > 1 && /^[A-Z0-9]{1,3}$/.test(t[0]) && /^[A-Z0-9]{3,}/.test(t[1])) return t[0] + t.slice(1).join(' ');
      return t.join(' ');
    };
    const same = join(line.slice(m.index + m[0].length)).match(VALUE);
    if (same) return clean(same[0]);
    const next = join(lines[i + 1]).match(VALUE);
    if (next) return clean(next[0]);
  }
  return null;
}

/** Fix common OCR slips in a value: O↔0 and I/L↔1 inside digit runs. */
export function fixOcrValue(value) {
  return clean(value)
    .replace(/(?<=\d)[O](?=\d)/g, '0')
    .replace(/(?<=\d)[IL](?=\d)/g, '1');
}

/** Pull labeled model/serial values out of OCR text. */
export function parseOcrText(raw) {
  const text = String(raw || '').toUpperCase().replace(/[|]/g, 'I');
  const model = valueAfter(text, MODEL_LABEL);
  const serial = valueAfter(text, SERIAL_LABEL);
  return {
    model: model && model.length >= 4 ? fixOcrValue(model) : null,
    serial: serial && serial.length >= 5 ? fixOcrValue(serial) : null,
  };
}

/**
 * Collects reads over time and decides when each field is locked.
 *  - A barcode read locks immediately (barcodes are exact).
 *  - An OCR read must be seen twice before it locks (one blurry frame can't win).
 *  - A locked barcode value is never replaced by OCR.
 */
export class PlateReadTracker {
  constructor({ make = '', ocrConfirmations = 2 } = {}) {
    this.make = make;
    this.needed = ocrConfirmations;
    this.fields = {
      model: { value: '', source: null, locked: false, seen: 0 },
      serial: { value: '', source: null, locked: false, seen: 0 },
    };
    this.unassignedCodes = [];
  }

  snapshot() {
    return {
      model: { ...this.fields.model },
      serial: { ...this.fields.serial },
      done: this.fields.model.locked && this.fields.serial.locked,
    };
  }

  /** @returns {string[]} fields that just locked */
  addBarcode(raw) {
    const { label, value } = stripLabel(raw);
    if (!value || value.length < 4) return [];
    const kind = label || classifyCode(value, { make: this.make }).kind;
    if (kind) return this.#lock(kind, value, 'barcode');
    if (!this.unassignedCodes.includes(value)) this.unassignedCodes.push(value);
    return this.#resolveUnassigned();
  }

  addOcr(text) {
    const { model, serial } = parseOcrText(text);
    const locked = [];
    for (const [kind, value] of [['model', model], ['serial', serial]]) {
      if (!value) continue;
      const f = this.fields[kind];
      if (f.locked) continue;
      if (f.value === value && f.source === 'ocr') f.seen += 1;
      else Object.assign(f, { value, source: 'ocr', seen: 1 });
      // A labeled read that also looks like the right kind of code is trusted on the
      // first pass; anything less sure needs a second matching read.
      const agrees = classifyCode(value, { make: this.make }).kind === kind;
      if (f.seen >= this.needed || (agrees && f.seen >= 1)) {
        f.locked = true;
        locked.push(kind);
      }
    }
    return locked;
  }

  /** Manual edits from the confirm panel. */
  set(kind, value) {
    Object.assign(this.fields[kind], { value: clean(value), source: 'manual', locked: Boolean(clean(value)) });
  }

  swap() {
    const { model, serial } = this.fields;
    this.fields = { model: { ...serial }, serial: { ...model } };
  }

  #lock(kind, value, source) {
    const f = this.fields[kind];
    if (f.locked && f.source === 'barcode') return [];
    Object.assign(f, { value, source, locked: true, seen: this.needed });
    return [kind];
  }

  // Two unlabeled, unclassifiable barcodes: the more model-like one is the model.
  #resolveUnassigned() {
    const open = ['model', 'serial'].filter((k) => !this.fields[k].locked);
    if (!open.length || !this.unassignedCodes.length) return [];
    if (open.length === 1) {
      const pick = this.unassignedCodes.find((c) => c !== this.fields.model.value && c !== this.fields.serial.value);
      return pick ? this.#lock(open[0], pick, 'barcode') : [];
    }
    if (this.unassignedCodes.length < 2) return [];
    const [a, b] = this.unassignedCodes;
    const sa = classifyCode(a, { make: this.make }).score;
    const sb = classifyCode(b, { make: this.make }).score;
    const [model, serial] = sa >= sb ? [a, b] : [b, a];
    return [...this.#lock('model', model, 'barcode'), ...this.#lock('serial', serial, 'barcode')];
  }
}
