/**
 * Turns raw barcode / OCR text from an appliance rating plate into a model and serial.
 * Pure functions + a small tracker so the live scanner can decide when a value is "locked".
 */

// A label must end at a word break (or run straight into "NO"), so "SERVICE" or "MODERN" never
// count as labels. S/N is often read as "SIN", "S1N" or "5/N"; LG prints "S/No.".
const LABEL_END = '(?=N[O0]|[^A-Z]|$)';
const MODEL_LABEL = new RegExp(`(?:^|[^A-Z])(?:M[O0]D(?:E[LI1])?|MDL|M\\/N|MN)${LABEL_END}\\s*(?:N[O0]\\.?|#|NUMBER|NUM)?\\s*[:.#\\-]?\\s*`);
const SERIAL_LABEL = new RegExp(`(?:^|[^A-Z])(?:SER(?:[I1lL]A[LI1])?|[S5][\\/I1L]N(?:[O0](?=[^A-Z]|$))?|SN|SR)${LABEL_END}\\s*(?:N[O0]\\.?|#|NUMBER|NUM)?\\s*[:.#\\-]?\\s*`);
const VALUE = /[A-Z0-9][A-Z0-9\-\/\.]{3,24}/g;

// Unlabeled codes longer than this are box / SKU / internal codes (LG's 20-digit plate
// barcode), never a model or serial.
const MAX_UNLABELED = 18;

function clean(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[‐-―]/g, '-')
    .replace(/^[\s:.#\-]+|[\s:.#\-\/]+$/g, '')
    .replace(/\s+/g, '');
}

const JUNK = [
  /:\/\/|^HTTPS?|^WWW\.|BIT\.LY|\.(?:COM|NET|ORG|LY|GOV|CA)(?:\/|$)/, // QR links
  /^\d+(?:\.\d+)?(?:V|VAC|VDC|HZ|A|AMPS?|W|WATTS?|KW|PSIG?|OZ|G|GRAMS?|MM|IN|LBS?)$/, // ratings
  /^\d+V(?:AC|DC)?[~\/]/, // "120V~10A"
  /^\d{2,3}VAC/,
  /^R-?\d{3}[A-Z]?$/, // refrigerant: R134A, R600A
  /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}$/, // dates: 14.08.2024
];

/** URLs, electrical ratings, refrigerant and dates are never a model or serial. */
export function isJunkCode(raw) {
  const v = clean(raw);
  return !v || JUNK.some((re) => re.test(v));
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
  if (v.length < 5 || v.length > 25 || isJunkCode(v)) return { kind: null, score: 0 };
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
  if (/^\d{3}[A-Z]{4}[A-Z0-9]{5}$/.test(v)) score -= 4; // LG serial: 608TNEP2B268
  if (/^\d[A-Z0-9]{7}\d{6}[A-Z]$/.test(v) && /[A-Z]/.test(v.slice(1, 8))) score -= 4; // Samsung serial: 1H7Q43AL301843R
  if (/^[A-Z]{2}\d{6}[A-Z]?$/.test(v)) score -= 5; // GE serial: DZ237098G, MD511803
  if (v.length >= 14 && v.length <= 16 && !/[\/\.\-]/.test(v) && digits >= 6) score -= 2; // Samsung serial
  if (brand.includes('samsung') && v.length === 15 && /^[0-9A-Z]{15}$/.test(v)) score -= 3;
  if (digits / v.length > 0.8) score -= 1;
  if (letters === 0 && v.length >= 8) score -= 1;

  if (score >= 2) return { kind: 'model', score };
  if (score <= -2) return { kind: 'serial', score };
  return { kind: null, score };
}

// OCR often splits a value with single spaces ("C3 4512045"); rejoin those.
// Only a short leading fragment is rejoined, so "WFW5620HW0 120V" stays two things.
function joinSplit(s) {
  const t = String(s || '').trim().split(/\s+/);
  if (t.length > 1 && /^[A-Z0-9]{1,3}$/.test(t[0]) && /^[A-Z0-9]{3,}/.test(t[1])) return t[0] + t.slice(1).join(' ');
  return t.join(' ');
}

/**
 * First usable code in a stretch of text. Words without a digit ("MODELE", "CODE", "NAME")
 * and junk (URLs, "115VAC", "R134A") are stepped over, so "MODEL / MODELE : WM4000HWA"
 * finds WM4000HWA instead of giving up on the line.
 */
function firstValue(str, minLength) {
  for (const hit of joinSplit(str).matchAll(VALUE)) {
    const v = clean(hit[0]);
    if (v.length >= minLength && /\d/.test(v) && !isJunkCode(v)) return v;
  }
  return null;
}

/**
 * Value printed after a label: on the same line, or on the next non-blank line (OCR often
 * puts an empty line between "S/N" and the number). A label with no usable value doesn't stop
 * the search; the next label further down gets a turn ("SERIAL NO." in fine print, then "S/N").
 */
function valueAfter(text, labelRe, otherRe, minLength = 4) {
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(labelRe);
    if (!m) continue;
    // Stop at the other label on the same line ("MODEL ... SERIAL NO. ...").
    let rest = line.slice(m.index + m[0].length);
    const cut = rest.search(otherRe);
    if (cut >= 0) rest = rest.slice(0, cut);
    const same = firstValue(rest, minLength);
    if (same) return same;
    let j = i + 1;
    while (j < lines.length && j <= i + 3 && !lines[j].trim()) j += 1;
    // Don't borrow the value of the next label ("S/N" followed by "MODEL ...").
    if (j < lines.length && !MODEL_LABEL.test(lines[j]) && !SERIAL_LABEL.test(lines[j])) {
      const next = firstValue(lines[j], minLength);
      if (next) return next;
    }
  }
  return null;
}

// Model prefixes that are always followed by two digits (DVE50..., WM4000..., PFD87...).
// OCR reads those digits as look-alike letters ("DVES0BG8300V"); put them back.
const MODEL_PREFIXES = [
  'DVE', 'DVG', 'DV', 'WF', 'WA', 'RF', 'RS', 'RT', 'NE', 'NX', 'DW', // Samsung
  'WM', 'WT', // LG laundry
  'GTW', 'GTD', 'GFW', 'GFD', 'GNE', 'GSS', 'GDT', 'GDF', 'GTE', 'PFD', 'PFE', 'PVD', 'PYE', 'PDT', // GE
  'WTW', 'WFW', 'WED', 'WGD', 'WRF', 'WRS', 'WRT', 'WDT', 'WZF', 'MVW', 'MHW', 'MED', 'MGD', // Whirlpool / Maytag
  'FFTR', 'FFSS', // Frigidaire
].sort((a, b) => b.length - a.length);
const LOOKS_LIKE_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };

function fixModelPrefix(v) {
  const p = MODEL_PREFIXES.find((x) => v.startsWith(x));
  if (!p) return v;
  const two = v.slice(p.length, p.length + 2);
  if (two.length < 2 || !/\d/.test(two) || ![...two].every((c) => /\d/.test(c) || LOOKS_LIKE_DIGIT[c])) return v;
  return p + [...two].map((c) => LOOKS_LIKE_DIGIT[c] || c).join('') + v.slice(p.length + 2);
}

/** Fix common OCR slips in a value: O↔0 and I/L↔1 inside digit runs, plus brand formats. */
export function fixOcrValue(value, kind = null) {
  let v = clean(value).replace(/(?<=\d)[O](?=\d)/g, '0');
  // I/L between digits is a 1 only when that leaves a plain letters-then-number code
  // ("AT12I456"). Date-coded serials keep real letters there: Insignia 24L31B03805.
  const ones = v.replace(/(?<=\d)[IL](?=\d)/g, '1');
  if (ones !== v && /^[A-Z]{0,3}\d{5,}[A-Z]{0,2}$/.test(ones)) v = ones;
  v = v
    // Revision codes at the end are digits ("...VB03", "...HW0"): an O right before the last
    // one or two digits is a zero. Letter O elsewhere ("WOS51...") is left alone.
    .replace(/O(?=\d{1,2}$)/, '0');
  if (kind === 'model') v = fixModelPrefix(v);
  // Samsung serials start with a digit: "OBE75BBX802256A" is 0BE75...
  if (kind === 'serial' && /^O/.test(v) && /^\d[A-Z0-9]{7}\d{6}[A-Z]$/.test(`0${v.slice(1)}`)) v = `0${v.slice(1)}`;
  return v;
}

/**
 * When a label wasn't read, the strongest model-looking and serial-looking codes in the
 * text (needs a letter and a digit, and a clear lean one way).
 */
function guessUnlabeled(text, { make, exclude }) {
  let model = null;
  let serial = null;
  for (const tok of text.split(/[\s,;()]+/)) {
    const v = clean(tok);
    if (v.length < 6 || v.length > MAX_UNLABELED || !/[A-Z]/.test(v) || !/\d/.test(v) || exclude.includes(v)) continue;
    const { score } = classifyCode(v, { make });
    if (score >= 3 && (!model || score > model.score)) model = { v, score };
    if (score <= -3 && (!serial || score < serial.score)) serial = { v, score };
  }
  return { model: model?.v || null, serial: serial?.v || null };
}

/**
 * Pull model/serial values out of OCR text.
 * model / serial come from a MODEL or S/N label; guesses are unlabeled codes that only look
 * like one (used when the label itself was misread).
 */
export function parseOcrText(raw, { make = '' } = {}) {
  const text = String(raw || '').toUpperCase()
    .replace(/[|]/g, 'I')
    // "UL MODEL 20UFA" is the safety listing, not the appliance model.
    .replace(/(^|[^A-Z])UL\s*M[O0]DE[LI1]/g, '$1UL-LISTING');
  const m = valueAfter(text, MODEL_LABEL, SERIAL_LABEL, 4);
  const s = valueAfter(text, SERIAL_LABEL, MODEL_LABEL, 5);
  const model = m ? fixOcrValue(m, 'model') : null;
  const serial = s ? fixOcrValue(s, 'serial') : null;
  const g = guessUnlabeled(text, { make, exclude: [model, serial].filter(Boolean) });
  return {
    model,
    serial,
    guesses: {
      model: model ? null : (g.model ? fixOcrValue(g.model, 'model') : null),
      serial: serial ? null : (g.serial ? fixOcrValue(g.serial, 'serial') : null),
    },
  };
}

const OCR_LOCK_WEIGHT = 4;

/**
 * Collects reads over time and decides when each field is locked.
 *  - A barcode read locks immediately (barcodes are exact), unless it's junk (URL, box code).
 *  - Text reads are votes. A normal read is worth 1, a zoomed second-look read 2; a value locks
 *    at 4, so no single frame can lock a field and a one-off misread never beats a value that
 *    keeps coming back.
 *  - Text that matches a barcode seen on the plate locks straight away as that barcode.
 *  - A locked barcode value is never replaced by OCR.
 */
export class PlateReadTracker {
  constructor({ make = '', ocrLockWeight = OCR_LOCK_WEIGHT } = {}) {
    this.make = make;
    this.needed = ocrLockWeight;
    this.fields = {
      model: { value: '', source: null, locked: false, seen: 0 },
      serial: { value: '', source: null, locked: false, seen: 0 },
    };
    this.votes = { model: new Map(), serial: new Map() };
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
    if (!value || value.length < 4 || isJunkCode(value)) return [];
    if (!label && value.length > MAX_UNLABELED) return [];
    const kind = label || classifyCode(value, { make: this.make }).kind || this.#kindFromVotes(value);
    if (kind) return this.#lock(kind, value, 'barcode');
    if (!this.unassignedCodes.includes(value)) this.unassignedCodes.push(value);
    return this.#resolveUnassigned();
  }

  /**
   * @param {string} text OCR text
   * @param {{ weight?: number }} opts weight 2 for a zoomed single-line read
   */
  addOcr(text, { weight = 1 } = {}) {
    const { model, serial, guesses } = parseOcrText(text, { make: this.make });
    const locked = [];
    for (const [kind, labeled] of [['model', model], ['serial', serial]]) {
      const value = labeled || guesses[kind];
      if (!value) continue;
      const f = this.fields[kind];
      if (f.locked) continue;
      const other = this.fields[kind === 'model' ? 'serial' : 'model'];
      if (other.locked && other.value === value) continue;
      if (this.unassignedCodes.includes(value)) {
        this.unassignedCodes = this.unassignedCodes.filter((c) => c !== value);
        locked.push(...this.#lock(kind, value, 'barcode'));
        continue;
      }
      // An unlabeled guess counts for less than a read next to its label.
      const votes = this.votes[kind];
      votes.set(value, (votes.get(value) || 0) + (labeled ? weight : Math.min(weight, 1)));
      let best = value;
      let bestWeight = 0;
      votes.forEach((n, v) => {
        if (n > bestWeight) {
          best = v;
          bestWeight = n;
        }
      });
      Object.assign(f, { value: best, source: 'ocr', seen: bestWeight });
      if (bestWeight >= this.needed) {
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
    this.votes = { model: this.votes.serial, serial: this.votes.model };
  }

  // A barcode the text reader has already voted for under one label.
  #kindFromVotes(value) {
    if (this.votes.model.has(value)) return 'model';
    if (this.votes.serial.has(value)) return 'serial';
    return null;
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

const MODEL_WORD = /^(?:M[O0]D(?:E[LI1])?|MDL|M\/N)$/;
const SERIAL_WORD = /^(?:SER(?:[I1L]A[LI1])?|[S5]\/?[I1L]?N[O0]?|SN)$/;

/**
 * From OCR word boxes, the MODEL / S/N label words worth a zoomed second look, biggest
 * first: the real labels are printed larger than "model no. and serial no." fine print.
 * @param {{ text: string, bbox: {x0,y0,x1,y1} }[]} words
 */
export function findLabelWords(words) {
  const out = { model: [], serial: [] };
  for (const w of words || []) {
    let t = String(w?.text || '').toUpperCase().replace(/[:.#]+$/, '');
    if (!w?.bbox || !t) continue;
    // Bilingual labels come through as one word: "MODEL/MODELE", "SERIAL/SERIE".
    if (t.length > 4 && !/^[S5]\//.test(t)) t = t.split('/')[0];
    if (MODEL_WORD.test(t)) out.model.push(w);
    else if (SERIAL_WORD.test(t)) out.serial.push(w);
  }
  const tall = (w) => w.bbox.y1 - w.bbox.y0;
  out.model.sort((a, b) => tall(b) - tall(a));
  out.serial.sort((a, b) => tall(b) - tall(a));
  return out;
}
