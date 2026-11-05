import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LaserIcon, laserTileStyle } from '../navigation/LaserBarParts';
import { createBarcodeEngine, createOcrEngine, fitCanvas, grabRegion, zoomLine } from '../../lib/plateScanEngines';
import { findLabelWords, PlateReadTracker } from '../../utils/plateParse';
import { loadPhoto, photoBlob, readSnap } from '../../lib/plateSnapRead';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const BARCODE_EVERY_MS = 140;
const OCR_EVERY_MS = 700;
const FULL_GRAB_MAX = 2800; // cap the full-resolution grab (memory on older phones)
const SCRAMBLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const VERTICAL_KEY = 'td_plate_scan_vertical';
// Live text reading on the camera feed. Off by default: it's what heats the phone, and
// Snap tag reads text far better from a real photo. Kept for comparing on real tags.
const LIVE_TEXT_KEY = 'td_plate_scan_live_text';

function readPref(key) {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writePref(key, on) {
  try { window.localStorage.setItem(key, on ? '1' : '0'); } catch { /* private mode */ }
}

const SNAP_STAGES = {
  loading: 'OPENING PHOTO',
  engine: 'LOADING TEXT READER',
  barcode: 'LOOKING FOR BARCODES',
  text: 'READING THE TAG',
  lines: 'ZOOMING IN ON MODEL / SERIAL',
  turn: 'TRYING IT SIDEWAYS',
};

/**
 * Map a box from a rotated decode canvas back to the upright guide box.
 * rotate -90 (counter-clockwise): canvas (x, y) came from source (H - y, x), H = canvas.height.
 * rotate  90 (clockwise):         canvas (x, y) came from source (y, W - x), W = canvas.width.
 */
function unrotateBox(b, rotate, canvas) {
  if (rotate === -90) return { x: canvas.height - b.y - b.h, y: b.x, w: b.h, h: b.w };
  if (rotate === 90) return { x: b.y, y: canvas.width - b.x - b.w, w: b.h, h: b.w };
  return b;
}

/** Size of the guide region in source pixels (undoing any rotation). */
function sourceSize(canvas, rotate) {
  return rotate ? { w: canvas.height, h: canvas.width } : { w: canvas.width, h: canvas.height };
}

/** Characters "decode" into place whenever the value changes. */
function ScrambleText({ value, placeholder }) {
  const [shown, setShown] = useState(value || '');
  useEffect(() => {
    if (!value) {
      setShown('');
      return undefined;
    }
    let frame = 0;
    const total = 14;
    const id = setInterval(() => {
      frame += 1;
      const settled = Math.floor((frame / total) * value.length);
      setShown(
        value
          .split('')
          .map((c, i) => (i < settled ? c : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]))
          .join(''),
      );
      if (frame >= total) {
        clearInterval(id);
        setShown(value);
      }
    }, 28);
    return () => clearInterval(id);
  }, [value]);
  return shown ? <span>{shown}</span> : <span style={{ opacity: 0.35 }}>{placeholder}</span>;
}

function stateOf(f) {
  if (f.locked) return 'locked';
  if (f.value) return 'reading';
  return 'searching';
}

function Readout({ label, field }) {
  const s = stateOf(field);
  const colors = {
    searching: { border: 'rgba(148,163,184,0.25)', chipBg: 'rgba(148,163,184,0.12)', chip: '#94A3B8', text: '#64748B' },
    reading: { border: 'rgba(34,211,238,0.55)', chipBg: 'rgba(34,211,238,0.14)', chip: '#67E8F9', text: '#A5F3FC' },
    locked: { border: 'rgba(110,231,183,0.9)', chipBg: '#34D399', chip: '#03140C', text: '#ECFEFF' },
  }[s];
  const chip = s === 'locked' ? (field.source === 'barcode' ? 'BARCODE' : field.source === 'manual' ? 'TYPED' : 'TEXT') : s === 'reading' ? 'READING' : 'SEARCHING';
  return (
    <div
      className={s === 'locked' ? 'ps-lock-pop' : ''}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: 'rgba(6,12,22,0.78)',
        boxShadow: s === 'locked' ? '0 0 18px rgba(52,211,153,0.35)' : 'none',
        transition: 'border-color .25s, box-shadow .25s',
      }}
    >
      <span style={{ width: 54, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: '#5FB7C9' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 17, fontWeight: 700, letterSpacing: '0.06em', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <ScrambleText value={field.value} placeholder="— — — — — —" />
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.14em',
          padding: '3px 7px',
          borderRadius: 6,
          background: colors.chipBg,
          color: colors.chip,
        }}
        className={s === 'searching' ? 'ps-blink' : ''}
      >
        {chip}
      </span>
    </div>
  );
}

/** Map the on-screen guide box to the matching region of the (object-fit: cover) video. */
function guideToVideoRect(video, box) {
  const vr = video.getBoundingClientRect();
  const br = box.getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !vr.width) return null;
  const scale = Math.max(vr.width / vw, vr.height / vh);
  const dispW = vw * scale;
  const dispH = vh * scale;
  const offX = (vr.width - dispW) / 2;
  const offY = (vr.height - dispH) / 2;
  const x = (br.left - vr.left - offX) / dispW;
  const y = (br.top - vr.top - offY) / dispH;
  return { x, y, w: br.width / dispW, h: br.height / dispH };
}

/**
 * Full-screen rating-plate scanner.
 *  - Live view: barcodes are read off the camera feed and lock as soon as they're seen.
 *    Live text reading can be switched on (LIVE TEXT in the header); it's off by default.
 *  - Snap tag: opens the iPhone's own camera; the photo is swept and read for barcodes and
 *    text (lib/plateSnapRead), then goes to the confirm panel.
 *
 * onSave({ model, serial, photo }) — photo is a JPEG Blob of the plate (or null).
 */
export default function PlateScanner({ open, onClose, onSave, make = '', initialModel = '', initialSerial = '' }) {
  const videoRef = useRef(null);
  const boxRef = useRef(null);
  const canvasBarRef = useRef(null);
  const canvasOcrRef = useRef(null);
  const canvasFullRef = useRef(null); // full-resolution grab of the guide box (for the second look)
  const canvasLineRef = useRef(null); // one zoomed label line
  const trackerRef = useRef(null);
  const streamRef = useRef(null);
  const runningRef = useRef(false);
  const ocrRef = useRef(null);
  const ocrPromiseRef = useRef(null); // one text engine per scanner, even across rescans
  const sessionRef = useRef(0); // bumps on every start/stop; stale async work checks it and bails
  const mountedRef = useRef(true);
  const photoPromiseRef = useRef(null);
  const barcodeRef = useRef(null);
  const verticalRef = useRef(false);
  const liveTextRef = useRef(false);
  const snapInputRef = useRef(null);
  const snapWaitRef = useRef(false); // native camera is open; restart live view if they cancel
  const snapRunRef = useRef(0); // bumps per photo so a stale read can't land
  const ocrLoopRef = useRef(0); // only the newest live-text loop keeps running
  // Which way sideways text runs isn't known up front: try both until one reads well.
  const ocrTurnRef = useRef({ dir: -90, settled: false });

  const [phase, setPhase] = useState('starting'); // starting | scanning | confirm | error
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({ model: { value: '' }, serial: { value: '' }, done: false });
  const [ocrStatus, setOcrStatus] = useState({ ready: false, progress: 0, failed: false });
  const [barcodeKind, setBarcodeKind] = useState(null);
  const [hits, setHits] = useState([]); // barcode markers in box coords
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [draft, setDraft] = useState({ model: initialModel, serial: initialSerial });
  const [photo, setPhoto] = useState(null);
  const [flash, setFlash] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState(null);
  const [vertical, setVertical] = useState(false);
  const scanStartRef = useRef(0);
  const [liveText, setLiveText] = useState(false);
  const [snap, setSnap] = useState(null); // { url, stage } while a Snap photo is shown

  const publish = useCallback((justLocked = []) => {
    const snap = trackerRef.current.snapshot();
    setFields(snap);
    if (justLocked.length) {
      setFlash((n) => n + 1);
      try { navigator.vibrate?.(35); } catch { /* not supported */ }
    }
    return snap;
  }, []);

  // Returns a promise for the JPEG so Save can wait for it (toBlob is async).
  const capturePhoto = useCallback(() => {
    const v = videoRef.current;
    if (!v?.videoWidth) {
      photoPromiseRef.current = Promise.resolve(null);
      return photoPromiseRef.current;
    }
    const c = document.createElement('canvas');
    const scale = Math.min(1, 1600 / v.videoWidth);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    photoPromiseRef.current = new Promise((resolve) => {
      c.toBlob((b) => {
        if (b) setPhoto(b);
        resolve(b || null);
      }, 'image/jpeg', 0.85);
    });
    return photoPromiseRef.current;
  }, []);

  const goConfirm = useCallback(() => {
    runningRef.current = false;
    capturePhoto();
    const snap = trackerRef.current?.snapshot();
    setDraft({
      model: snap?.model.value || initialModel || '',
      serial: snap?.serial.value || initialSerial || '',
    });
    setPhase('confirm');
  }, [capturePhoto, initialModel, initialSerial]);

  const stopCamera = useCallback(() => {
    sessionRef.current += 1; // anything still starting up for the old session will stop itself
    runningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    barcodeRef.current?.close?.();
    barcodeRef.current = null;
  }, []);

  // Text engine (Tesseract), loaded once and shared by live text and Snap tag.
  // Resolves to the engine, or null if it failed to load.
  const loadOcr = useCallback(async () => {
    try {
      if (!ocrPromiseRef.current) {
        setOcrStatus((s) => ({ ...s, failed: false }));
        ocrPromiseRef.current = createOcrEngine((p) => {
          if (mountedRef.current) setOcrStatus((s) => ({ ...s, progress: p }));
        });
      }
      const pending = ocrPromiseRef.current;
      const engine = await pending;
      // Unmounted (or replaced) while loading: the cleanup that dropped this promise
      // closes the engine, so never adopt it here.
      if (!mountedRef.current || ocrPromiseRef.current !== pending) return null;
      ocrRef.current = engine;
      setOcrStatus({ ready: true, progress: 1, failed: false });
      return engine;
    } catch {
      ocrPromiseRef.current = null; // allow a retry next time
      if (mountedRef.current) setOcrStatus({ ready: false, progress: 0, failed: true });
      return null;
    }
  }, []);

  // Live text reading (off by default: it is what heats the phone). Runs until the camera
  // stops, the session changes, or LIVE TEXT is switched off.
  const runOcrLoop = useCallback(async (session) => {
    ocrLoopRef.current += 1;
    const loop = ocrLoopRef.current;
    const alive = () => runningRef.current && liveTextRef.current && ocrLoopRef.current === loop && sessionRef.current === session && mountedRef.current;
    if (!(await loadOcr()) || !alive()) return;
    while (alive()) {
      const v = videoRef.current;
      const box = boxRef.current;
      const rect = v && box ? guideToVideoRect(v, box) : null;
      const turn = ocrTurnRef.current;
      const rotate = verticalRef.current ? turn.dir : 0;
      // One grab at full camera resolution; the reading copy is shrunk from that same frame
      // so label boxes found in it line up with the sharp original.
      const full = rect && grabRegion(v, rect, canvasFullRef.current, { maxWidth: FULL_GRAB_MAX, rotate, readable: false });
      const canvas = full && fitCanvas(full, canvasOcrRef.current, { maxWidth: rotate ? 1400 : 1000, enhance: true });
      if (canvas) {
        try {
          const { text, confidence, words } = await ocrRef.current.read(canvas);
          if (!alive()) return;
          if (rotate && !turn.settled) {
            // Upright text reads with real confidence; sideways text is noise. Keep the
            // direction that reads well, otherwise flip and try the other way.
            if (confidence >= 40 && /[A-Z0-9]{5,}/.test(text)) turn.settled = true;
            else turn.dir = -turn.dir;
          }
          let snap = publish(trackerRef.current.addOcr(text));

          // Second look (counts double toward a lock): small or spaced-out values (fridge S/N tags) misread in the full
          // pass. Zoom on the line next to each still-open field's label and read just that.
          const labels = findLabelWords(words);
          for (const kind of ['model', 'serial']) {
            if (snap.done || snap[kind].locked) continue;
            for (const label of labels[kind].slice(0, 2)) {
              const line = zoomLine(full, canvas, label.bbox, canvasLineRef.current);
              if (!line) continue;
              const r = await ocrRef.current.readLine(line);
              if (!alive()) return;
              if (r.confidence < 40) continue;
              const before = snap[kind].value;
              snap = publish(trackerRef.current.addOcr(`${kind === 'serial' ? 'S/N' : 'MODEL'} ${r.text}`, { weight: 2 }));
              if (snap[kind].locked || snap[kind].value !== before) break;
            }
          }

          // Coach the user when nothing has locked from a barcode after a few seconds.
          const anyBarcode = snap.model.source === 'barcode' || snap.serial.source === 'barcode';
          if (!anyBarcode && Date.now() - scanStartRef.current > 3500 && /\S{4,}/.test(text)) {
            setHint(labels.model.length || labels.serial.length ? 'Reading the tag… hold steady' : 'Barcode? Move closer so it fills the box');
          }
          if (snap.done) {
            setTimeout(() => alive() && goConfirm(), 650);
            return;
          }
        } catch { /* keep scanning */ }
      }
      await new Promise((r) => setTimeout(r, OCR_EVERY_MS));
    }
  }, [loadOcr, publish, goConfirm]);


  // Start camera + engines.
  const start = useCallback(async () => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    const stale = () => sessionRef.current !== session || !mountedRef.current;
    const alive = () => runningRef.current && !stale();
    setPhase('starting');
    setError(null);
    setHits([]);
    trackerRef.current = new PlateReadTracker({ make });
    setFields(trackerRef.current.snapshot());
    ocrTurnRef.current = { dir: -90, settled: false };

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError({ title: 'Camera needs a secure connection', detail: 'Open TechDeck over https (or the deployed site) to use the scanner. You can still type the numbers in.' });
      setPhase('error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ title: 'No camera available', detail: 'This browser can’t open the camera. You can type the numbers in.' });
      setPhase('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        // Ask for the most pixels the camera has in either orientation; small text needs them.
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 3840 } },
      });
      // Closed (or rescanned) while the permission prompt was up: release this camera.
      const v = videoRef.current;
      if (stale() || !v) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() || {};
      setTorch({ supported: Boolean(caps.torch), on: false });
      try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch { /* optional */ }
    } catch (e) {
      if (stale()) return;
      const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
      setError({
        title: denied ? 'Camera permission is off' : 'Couldn’t start the camera',
        detail: denied ? 'Allow camera access for this site in Settings, then try again.' : (e?.message || 'Try again, or type the numbers in.'),
      });
      setPhase('error');
      return;
    }

    setPhase('scanning');
    setHint(null);
    scanStartRef.current = Date.now();
    runningRef.current = true;

    // Barcode loop (fast).
    const barcode = await createBarcodeEngine();
    if (stale()) {
      barcode.close?.();
      return;
    }
    barcodeRef.current = barcode;
    setBarcodeKind(barcode.kind);
    (async function loop() {
      while (alive()) {
        const v = videoRef.current;
        const box = boxRef.current;
        const rect = v && box ? guideToVideoRect(v, box) : null;
        // Vertical mode: turn the strip upright so 1D barcodes read along the strips.
        const rotate = verticalRef.current ? -90 : 0;
        const canvas = rect && grabRegion(v, rect, canvasBarRef.current, { maxWidth: 1800, rotate });
        const began = performance.now();
        if (canvas) {
          try {
            const found = await barcode.decode(canvas);
            if (found.length && alive()) {
              const src = sourceSize(canvas, rotate);
              const bw = box.clientWidth / src.w;
              const bh = box.clientHeight / src.h;
              // 1D readers report a scan line, so grow it into a target box around the code.
              setHits(found.filter((f) => f.box).map((f, i) => {
                const b = unrotateBox(f.box, rotate, canvas);
                if (rotate) {
                  const h = b.h * bh;
                  const w = Math.max(b.w * bw, h * 0.28);
                  const cx = (b.x + b.w / 2) * bw;
                  return { id: `${Date.now()}-${i}`, x: cx - w / 2, y: b.y * bh, w, h };
                }
                const w = b.w * bw;
                const h = Math.max(b.h * bh, w * 0.28);
                const cy = (b.y + b.h / 2) * bh;
                return { id: `${Date.now()}-${i}`, x: b.x * bw, y: cy - h / 2, w, h };
              }));
              let locked = [];
              for (const f of found) locked = locked.concat(trackerRef.current.addBarcode(f.text));
              const snap = publish(locked);
              if (snap.done) {
                setTimeout(() => alive() && goConfirm(), 650);
                return;
              }
            }
          } catch { /* keep scanning */ }
        }
        if (!liveTextRef.current && alive() && Date.now() - scanStartRef.current > 4000) {
          const s = trackerRef.current.snapshot();
          if (!s.model.value && !s.serial.value) setHint('No barcode? Tap Snap tag');
        }
        // Pace by how long a pass took so the phone's main thread (and the text
        // reader) always gets breathing room on slower devices.
        const spent = performance.now() - began;
        await new Promise((r) => setTimeout(r, Math.max(BARCODE_EVERY_MS, spent * 1.5)));
      }
    }());

    // Live text reading (if switched on) runs beside the barcode loop.
    if (liveTextRef.current) runOcrLoop(session);
  }, [make, publish, goConfirm, runOcrLoop]);

  useEffect(() => {
    if (!open) return undefined;
    setPhoto(null);
    photoPromiseRef.current = null;
    verticalRef.current = readPref(VERTICAL_KEY);
    liveTextRef.current = readPref(LIVE_TEXT_KEY);
    setLiveText(liveTextRef.current);
    setSnap(null);
    setVertical(verticalRef.current);
    setDraft({ model: initialModel, serial: initialSerial });
    start();
    return () => stopCamera();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // On unmount: stop the camera and close the text engine — including one that is
  // still loading (it is closed as soon as it finishes).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
      const pending = ocrPromiseRef.current;
      ocrPromiseRef.current = null;
      ocrRef.current = null;
      if (pending) pending.then((engine) => engine?.close?.()).catch(() => {});
    };
  }, [stopCamera]);

  // Barcode markers fade out on their own.
  useEffect(() => {
    if (!hits.length) return undefined;
    const t = setTimeout(() => setHits([]), 900);
    return () => clearTimeout(t);
  }, [hits]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch { /* ignore */ }
  };

  const toggleVertical = () => {
    const next = !verticalRef.current;
    verticalRef.current = next;
    setVertical(next);
    writePref(VERTICAL_KEY, next);
    // Reads from the old orientation are noise now: start the fields over.
    if (trackerRef.current) {
      trackerRef.current = new PlateReadTracker({ make });
      ocrTurnRef.current = { dir: -90, settled: false };
      setFields(trackerRef.current.snapshot());
      setHits([]);
      setHint(null);
      scanStartRef.current = Date.now();
    }
  };

  const toggleLiveText = () => {
    const next = !liveTextRef.current;
    liveTextRef.current = next;
    setLiveText(next);
    writePref(LIVE_TEXT_KEY, next);
    setHint(null);
    if (next && runningRef.current) runOcrLoop(sessionRef.current);
  };

  // Snap tag: hand off to the iPhone's own camera. No camera permission is involved (to the
  // browser it's a photo upload), and the photo is far sharper than a live video frame.
  const openSnap = () => {
    const input = snapInputRef.current;
    if (!input) return;
    snapRunRef.current += 1;
    stopCamera(); // the iPhone camera takes the camera over anyway; this also cools things off
    setSnap(null);
    snapWaitRef.current = true;
    loadOcr(); // warm up the text reader while the photo is being taken
    input.value = '';
    input.click();
  };

  const onSnapFile = async (e) => {
    const file = e.target.files?.[0];
    snapWaitRef.current = false;
    if (!file) {
      start();
      return;
    }
    stopCamera(); // a cancel fallback may have restarted the live view meanwhile
    snapRunRef.current += 1;
    const run = snapRunRef.current;
    const live = () => run === snapRunRef.current && mountedRef.current;
    // Fields the live view already locked from a barcode carry over (they're exact).
    const prior = trackerRef.current?.snapshot();
    const seed = prior ? ['model', 'serial'].filter((k) => prior[k].locked && prior[k].source === 'barcode').map((k) => `${k === 'model' ? 'MODEL' : 'SN'} ${prior[k].value}`) : [];
    setSnap({ url: URL.createObjectURL(file), stage: 'loading' });
    setPhase('reading');
    setHint(null);
    setHits([]);
    setPhoto(null);
    trackerRef.current = new PlateReadTracker({ make });
    setFields(trackerRef.current.snapshot());
    let barcode = null;
    try {
      const picture = await loadPhoto(file);
      if (!live()) return;
      photoPromiseRef.current = photoBlob(picture).then((b) => {
        if (b && live()) setPhoto(b);
        return b;
      });
      barcode = await createBarcodeEngine();
      if (!ocrRef.current) setSnap((s) => s && { ...s, stage: 'engine' });
      const ocr = await loadOcr();
      if (!live()) return;
      const { tracker } = await readSnap(picture, {
        barcode,
        ocr,
        make,
        vertical: verticalRef.current,
        seed,
        onStage: (stage) => live() && setSnap((s) => s && { ...s, stage }),
        onUpdate: (snapshot) => live() && setFields(snapshot),
        cancelled: () => !live(),
      });
      if (!live()) return;
      trackerRef.current = tracker;
      const result = tracker.snapshot();
      setFields(result);
      setDraft({
        model: result.model.value || initialModel || '',
        serial: result.serial.value || initialSerial || '',
      });
      if (result.model.value || result.serial.value) {
        setFlash((n) => n + 1);
        try { navigator.vibrate?.(35); } catch { /* not supported */ }
      }
      setPhase('confirm');
    } catch (err) {
      if (!live()) return;
      setError({ title: 'Couldn’t read that photo', detail: err?.message || 'Try another photo, or type the numbers in.' });
      setPhase('error');
    } finally {
      barcode?.close?.();
    }
  };

  // Cancelled out of the iPhone camera: bring the live view back. Safari fires "cancel" on
  // the input; older versions don't, so returning to the page without a photo counts too.
  useEffect(() => {
    if (!open) return undefined;
    const input = snapInputRef.current;
    const resume = () => {
      if (!snapWaitRef.current || !mountedRef.current) return;
      snapWaitRef.current = false;
      start();
    };
    let timer = null;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(resume, 3000); // fallback only; "change" lands well before this when a photo was taken
    };
    const onVisible = () => document.visibilityState === 'visible' && later();
    input?.addEventListener('cancel', resume);
    window.addEventListener('focus', later);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      input?.removeEventListener('cancel', resume);
      window.removeEventListener('focus', later);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, start]);

  // Free the Snap photo when it's replaced or the scanner closes.
  useEffect(() => () => {
    if (snap?.url) URL.revokeObjectURL(snap.url);
  }, [snap?.url]);

  const rescan = () => {
    snapRunRef.current += 1;
    setSnap(null);
    stopCamera();
    start();
  };

  const close = () => {
    snapRunRef.current += 1;
    snapWaitRef.current = false;
    stopCamera();
    onClose?.();
  };

  const save = async () => {
    setSaving(true);
    try {
      // The plate photo is encoded asynchronously; wait for it so it isn't dropped.
      const plate = photo || (photoPromiseRef.current ? await photoPromiseRef.current : null);
      await onSave?.({ model: draft.model.trim().toUpperCase(), serial: draft.serial.trim().toUpperCase(), photo: plate });
      stopCamera();
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const bothLocked = fields.model.locked && fields.serial.locked;
  const anyValue = Boolean(fields.model.value || fields.serial.value);
  const scanning = phase === 'scanning';

  return createPortal(
    <div className="ps-root" role="dialog" aria-modal="true" aria-label="Scan rating plate" style={{ position: 'fixed', inset: 0, zIndex: 30000, background: '#020509', color: '#E6EEF3', overflow: 'hidden', touchAction: 'none' }}>
      <style>{`
        @keyframes ps-sweep { 0% { transform: translate3d(0, 0, 0) } 100% { transform: translate3d(0, 100%, 0) } }
        @keyframes ps-sweep-x { 0% { transform: translate3d(0, 0, 0) } 100% { transform: translate3d(100%, 0, 0) } }
        @keyframes ps-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0.35 } }
        @keyframes ps-pulse { 0%, 100% { opacity: 0.55 } 50% { opacity: 1 } }
        @keyframes ps-hit { 0% { opacity: 0; transform: scale(1.25) } 25% { opacity: 1; transform: scale(1) } 100% { opacity: 0; transform: scale(1) } }
        @keyframes ps-flash { 0% { opacity: 0.55 } 100% { opacity: 0 } }
        @keyframes ps-lock-pop { 0% { transform: scale(0.97) } 40% { transform: scale(1.02) } 100% { transform: scale(1) } }
        @keyframes ps-panel-in { 0% { transform: translateY(40px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes ps-boot { 0% { clip-path: inset(50% 0 50% 0) } 100% { clip-path: inset(0 0 0 0) } }
        .ps-blink { animation: ps-blink 1s steps(1) infinite; will-change: opacity; }
        .ps-lock-pop { animation: ps-lock-pop .35s cubic-bezier(.2,.9,.3,1.2); }
        .ps-sweep { animation: ps-sweep 1.6s cubic-bezier(.45,.05,.55,.95) infinite alternate; will-change: transform; }
        .ps-sweep.ps-x { animation-name: ps-sweep-x; }
        .ps-sweep.ps-fast { animation-duration: 0.9s; }
        .ps-boot { animation: ps-boot .45s cubic-bezier(.2,.9,.25,1) both; }
        .ps-btn:focus-visible { outline: 2px solid #A5F3FC; outline-offset: 3px; }
        /* Guide box + readouts. Portrait: box up top, readouts along the bottom. */
        .ps-guide { position: absolute; left: 7%; right: 7%; top: 22%; aspect-ratio: 1.55 / 1; }
        /* Tall, narrow box for tags that run up the side of a tub or door. */
        .ps-guide.is-vert { left: 22%; right: 22%; top: calc(env(safe-area-inset-top, 0px) + 92px); bottom: calc(env(safe-area-inset-bottom, 0px) + 236px); aspect-ratio: auto; }
        .ps-panel { position: absolute; left: 16px; right: 16px; bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); display: flex; flex-direction: column; gap: 8px; }
        /* Phone on its side: box on the left sized to the short screen, readouts in a column on the right. */
        @media (orientation: landscape) and (max-height: 600px) {
          .ps-guide, .ps-guide.is-vert {
            left: calc(env(safe-area-inset-left, 0px) + 20px); right: auto; bottom: auto;
            top: 74px; height: calc(100% - 74px - 40px - env(safe-area-inset-bottom, 0px));
            aspect-ratio: 1.55 / 1; max-width: calc(100% - 380px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
          }
          .ps-guide.is-vert { aspect-ratio: 1 / 2.2; }
          .ps-panel {
            left: auto; right: calc(env(safe-area-inset-right, 0px) + 16px); width: 320px;
            top: 74px; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); justify-content: flex-end;
          }
        }
        @media (prefers-reduced-motion: reduce) { .ps-root * { animation-duration: 1ms !important; animation-iteration-count: 1 !important; } }
      `}</style>

      {/* Live camera */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="ps-boot"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: phase === 'confirm' ? 'blur(6px) brightness(0.45)' : 'none', transition: 'filter .3s' }}
      />
      {/* Snap tag photo, shown while it's read and behind the confirm panel */}
      {snap ? (
        <img
          src={snap.url}
          alt="Photo of the tag"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#020509', filter: phase === 'confirm' ? 'blur(6px) brightness(0.45)' : 'brightness(0.85)', transition: 'filter .3s' }}
        />
      ) : null}
      <input ref={snapInputRef} type="file" accept="image/*" capture="environment" onChange={onSnapFile} style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
      <canvas ref={canvasBarRef} style={{ display: 'none' }} />
      <canvas ref={canvasOcrRef} style={{ display: 'none' }} />
      <canvas ref={canvasFullRef} style={{ display: 'none' }} />
      <canvas ref={canvasLineRef} style={{ display: 'none' }} />

      {/* Top HUD */}
      <div style={{ position: 'absolute', zIndex: 2, top: 0, left: 0, right: 0, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, rgba(2,5,9,0.85), rgba(2,5,9,0))' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', color: '#67E8F9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: scanning ? '#F87171' : '#64748B', boxShadow: scanning ? '0 0 8px #F87171' : 'none' }} className={scanning ? 'ps-blink' : ''} />
            PLATE SCAN {scanning ? '// LIVE' : phase === 'reading' ? '// PHOTO' : ''}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#5B7083' }}>
            <span>BARCODE <span style={{ color: barcodeKind ? '#34D399' : '#64748B' }}>●</span></span>
            {/* Live text on/off. Off by default; Snap tag reads text from a photo instead. */}
            <button
              type="button"
              className="ps-btn"
              aria-pressed={liveText}
              aria-label="Live text reading"
              onClick={toggleLiveText}
              style={{ margin: '-8px 0', padding: '8px 8px', borderRadius: 7, fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', border: `1px solid ${liveText ? 'rgba(103,232,249,0.6)' : 'rgba(148,163,184,0.25)'}`, background: liveText ? 'rgba(34,211,238,0.12)' : 'transparent', color: liveText ? '#A5F3FC' : '#5B7083' }}
            >
              LIVE TEXT{' '}
              {!liveText ? (
                <span style={{ color: '#64748B' }}>OFF</span>
              ) : ocrStatus.failed ? (
                <span style={{ color: '#F87171' }}>FAILED</span>
              ) : ocrStatus.ready ? (
                <span style={{ color: '#34D399' }}>●</span>
              ) : (
                <span style={{ color: '#FBBF24', animation: 'ps-pulse 1s infinite', willChange: 'opacity' }}>{ocrStatus.progress > 0.02 ? `${Math.round(ocrStatus.progress * 100)}%` : '…'}</span>
              )}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="ps-btn"
          aria-label="Vertical tag mode"
          aria-pressed={vertical}
          onClick={toggleVertical}
          style={{ height: 44, padding: '0 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', transition: 'all .25s', ...(vertical ? { background: 'rgba(34,211,238,0.18)', border: '1px solid rgba(103,232,249,0.85)', color: '#A5F3FC', boxShadow: '0 0 14px rgba(34,211,238,0.35)' } : { background: 'rgba(13,22,38,0.8)', border: '1px solid rgba(255,255,255,0.16)', color: '#94A3B8' }) }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8" y="3" width="8" height="18" rx="2" />
            <path d="M11 7v10" />
          </svg>
          VERT
        </button>
        <button type="button" className="ps-btn" aria-label="Close scanner" onClick={close} style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(13,22,38,0.8)', border: '1px solid rgba(255,255,255,0.16)', color: '#CBD5E1' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        </div>
      </div>

      {/* Guide box */}
      <div
        ref={boxRef}
        className={`ps-guide${vertical ? ' is-vert' : ''}`}
        style={{
          borderRadius: 14,
          transition: 'opacity .25s',
          boxShadow: '0 0 0 100vmax rgba(2,6,12,0.62)',
          opacity: phase === 'confirm' || phase === 'reading' ? 0 : 1,
        }}
      >
        {/* faint HUD grid */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden', background: 'repeating-linear-gradient(0deg, rgba(34,211,238,0.06) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(34,211,238,0.05) 0 1px, transparent 1px 22px)' }} />
        {/* corner brackets */}
        {[
          { top: -2, left: -2, borderTop: 3, borderLeft: 3, radius: '14px 0 0 0' },
          { top: -2, right: -2, borderTop: 3, borderRight: 3, radius: '0 14px 0 0' },
          { bottom: -2, left: -2, borderBottom: 3, borderLeft: 3, radius: '0 0 0 14px' },
          { bottom: -2, right: -2, borderBottom: 3, borderRight: 3, radius: '0 0 14px 0' },
        ].map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: 34,
              height: 34,
              top: c.top,
              left: c.left,
              right: c.right,
              bottom: c.bottom,
              borderStyle: 'solid',
              borderColor: bothLocked ? '#6EE7B7' : '#67E8F9',
              borderWidth: `${c.borderTop || 0}px ${c.borderRight || 0}px ${c.borderBottom || 0}px ${c.borderLeft || 0}px`,
              borderRadius: c.radius,
              filter: `drop-shadow(0 0 6px ${bothLocked ? '#34D399' : '#22D3EE'})`,
              transform: bothLocked ? 'scale(0.94)' : 'scale(1)',
              transition: 'transform .3s cubic-bezier(.2,.9,.3,1.2), border-color .3s',
            }}
          />
        ))}
        {/* side ticks */}
        <span aria-hidden="true" style={{ position: 'absolute', top: '12%', bottom: '12%', left: -12, width: 4, background: 'repeating-linear-gradient(to bottom, rgba(103,232,249,0.6) 0 1px, transparent 1px 10px)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', top: '12%', bottom: '12%', right: -12, width: 4, background: 'repeating-linear-gradient(to bottom, rgba(103,232,249,0.6) 0 1px, transparent 1px 10px)' }} />

        {/* THE scan bar */}
        {scanning && !bothLocked ? (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 14 }}>
            {/* The wrapper fills the box and slides by its own size, so the sweep is a
                pure transform the GPU runs even while the readers keep the CPU busy. */}
            <div className={`ps-sweep${vertical ? ' ps-x' : ''}${anyValue ? ' ps-fast' : ''}`} style={{ position: 'absolute', inset: 0 }}>
              {vertical ? (
                <>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: '100%', width: 56, background: 'linear-gradient(90deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 56, background: 'linear-gradient(270deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
                  <div style={{ position: 'absolute', top: -4, bottom: -4, left: -1.5, width: 3, borderRadius: 2, background: 'linear-gradient(180deg, rgba(240,255,255,0), #F0FFFF 12%, #FFFFFF 50%, #F0FFFF 88%, rgba(240,255,255,0))', boxShadow: '0 0 8px #A5F3FC, 0 0 18px #22D3EE, 0 0 36px #22D3EE' }} />
                </>
              ) : (
                <>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', height: 64, background: 'linear-gradient(180deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 64, background: 'linear-gradient(0deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
                  <div style={{ position: 'absolute', left: -4, right: -4, top: -1.5, height: 3, borderRadius: 2, background: 'linear-gradient(90deg, rgba(240,255,255,0), #F0FFFF 12%, #FFFFFF 50%, #F0FFFF 88%, rgba(240,255,255,0))', boxShadow: '0 0 8px #A5F3FC, 0 0 18px #22D3EE, 0 0 36px #22D3EE' }} />
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* barcode hit markers */}
        {hits.map((h) => (
          <span key={h.id} aria-hidden="true" style={{ position: 'absolute', left: h.x - 6, top: h.y - 6, width: h.w + 12, height: h.h + 12, border: '2px solid #FF8A1F', borderRadius: 6, boxShadow: '0 0 14px rgba(255,138,31,0.7)', animation: 'ps-hit .9s ease-out both' }} />
        ))}

        {/* lock flash */}
        {flash ? <span key={flash} aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(110,231,183,0.35)', animation: 'ps-flash .45s ease-out both' }} /> : null}

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: -28, textAlign: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: bothLocked ? '#6EE7B7' : '#8FB3C4' }}>
          {phase === 'starting' ? 'STARTING CAMERA…' : bothLocked ? 'LOCKED' : (hint || (vertical ? 'LINE UP THE TAG' : 'LINE UP THE RATING PLATE')).toUpperCase()}
        </div>
      </div>

      {/* Readouts + controls */}
      {phase !== 'confirm' && phase !== 'error' && phase !== 'reading' ? (
        <div className="ps-panel">
          <Readout label="MODEL" field={fields.model} />
          <Readout label="SERIAL" field={fields.serial} />
          <div style={{ display: 'grid', gridTemplateColumns: torch.supported ? '44px 1fr 1.15fr 1.15fr' : '1fr 1.15fr 1.15fr', gap: 8, marginTop: 6 }}>
            {torch.supported ? (
              <button type="button" className="ps-btn" aria-label={torch.on ? 'Turn light off' : 'Turn light on'} aria-pressed={torch.on} onClick={toggleTorch} style={{ height: 48, borderRadius: 12, display: 'grid', placeItems: 'center', border: '1px solid rgba(251,191,36,0.5)', background: torch.on ? '#FBBF24' : 'rgba(13,22,38,0.85)', color: torch.on ? '#1A1000' : '#FBBF24' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2h6l-1 7h4l-8 13 2-9H8z" /></svg>
              </button>
            ) : null}
            <button type="button" className="ps-btn" onClick={goConfirm} style={{ height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(13,22,38,0.85)', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>
              Type it
            </button>
            <button type="button" className="ps-btn" onClick={openSnap} style={{ height: 48, borderRadius: 12, fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .25s', ...(anyValue ? { border: '1px solid rgba(103,232,249,0.45)', background: 'rgba(13,22,38,0.85)', color: '#A5F3FC' } : laserTileStyle('cyan')) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              Snap tag
            </button>
            <button type="button" className="ps-btn" disabled={!anyValue} onClick={goConfirm} style={{ height: 48, borderRadius: 12, fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .25s', ...laserTileStyle(anyValue ? 'cyan' : 'off') }}>
              <LaserIcon name="scan" size={16} strokeWidth={2.1} /> Use these
            </button>
          </div>
        </div>
      ) : null}

      {/* Reading a Snap photo: the scan bar sweeps the photo while the readers run */}
      {phase === 'reading' && snap ? (
        <>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div className="ps-sweep" style={{ position: 'absolute', inset: 0 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', height: 90, background: 'linear-gradient(180deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 90, background: 'linear-gradient(0deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
              <div style={{ position: 'absolute', left: -4, right: -4, top: -1.5, height: 3, borderRadius: 2, background: 'linear-gradient(90deg, rgba(240,255,255,0), #F0FFFF 12%, #FFFFFF 50%, #F0FFFF 88%, rgba(240,255,255,0))', boxShadow: '0 0 8px #A5F3FC, 0 0 18px #22D3EE, 0 0 36px #22D3EE' }} />
            </div>
          </div>
          {flash ? <span key={flash} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(110,231,183,0.25)', animation: 'ps-flash .45s ease-out both', pointerEvents: 'none' }} /> : null}
          <div className="ps-panel">
            <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: '#8FB3C4', marginBottom: 4 }} className="ps-blink">
              {SNAP_STAGES[snap.stage] || 'READING'}
              {snap.stage === 'engine' && ocrStatus.progress > 0.02 && ocrStatus.progress < 1 ? ` ${Math.round(ocrStatus.progress * 100)}%` : '…'}
            </div>
            <Readout label="MODEL" field={fields.model} />
            <Readout label="SERIAL" field={fields.serial} />
            <button type="button" className="ps-btn" onClick={rescan} style={{ height: 48, marginTop: 6, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(13,22,38,0.85)', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {/* Error state */}
      {phase === 'error' && error ? (
        <div style={{ position: 'absolute', left: 16, right: 16, top: '30%', padding: 18, borderRadius: 16, background: 'rgba(13,22,38,0.95)', border: '1px solid rgba(248,113,113,0.45)', animation: 'ps-panel-in .3s both' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: '#F87171' }}>SCANNER OFFLINE</div>
          <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>{error.title}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#94A3B8' }}>{error.detail}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" className="ps-btn" onClick={rescan} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#CBD5E1', fontWeight: 600 }}>Try again</button>
            {/* Snap tag never asks for camera permission, so it works even when the live camera can't. */}
            <button type="button" className="ps-btn" onClick={openSnap} style={{ flex: 1, height: 46, borderRadius: 12, fontWeight: 800, ...laserTileStyle('cyan') }}>Snap tag</button>
            <button type="button" className="ps-btn" onClick={() => setPhase('confirm')} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#CBD5E1', fontWeight: 600 }}>Type it</button>
          </div>
        </div>
      ) : null}

      {/* Confirm panel */}
      {phase === 'confirm' ? (
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', padding: 16, borderRadius: 18, background: 'linear-gradient(180deg, rgba(16,48,66,0.97), rgba(8,16,28,0.98))', border: '1px solid rgba(165,243,252,0.45)', boxShadow: '0 0 28px rgba(34,211,238,0.22), 0 24px 48px rgba(0,0,0,0.6)', animation: 'ps-panel-in .32s cubic-bezier(.2,.9,.25,1) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: '#5FB7C9' }}>CONFIRM // RATING PLATE</span>
            <button type="button" className="ps-btn" onClick={() => setDraft((d) => ({ model: d.serial, serial: d.model }))} style={{ minHeight: 34, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(34,211,238,0.4)', color: '#8FE6F3', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>
              Swap
            </button>
          </div>
          {[
            ['model', 'Model', fields.model.source],
            ['serial', 'Serial', fields.serial.source],
          ].map(([key, label, source]) => (
            <label key={key} style={{ display: 'block', marginTop: 12 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
                {label}
                {source && draft[key] === fields[key].value ? (
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: source === 'barcode' ? '#34D399' : '#67E8F9' }}>
                    {source === 'barcode' ? 'FROM BARCODE' : source === 'ocr' ? 'READ FROM TEXT — CHECK IT' : ''}
                  </span>
                ) : null}
              </span>
              <input
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value.toUpperCase() }))}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                style={{ width: '100%', height: 48, borderRadius: 12, padding: '0 12px', background: 'rgba(2,6,12,0.7)', border: '1px solid rgba(34,211,238,0.35)', color: '#ECFEFF', fontFamily: MONO, fontSize: 17, fontWeight: 700, letterSpacing: '0.06em', outline: 'none' }}
              />
            </label>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8, marginTop: 16 }}>
            {/* After a Snap, Retake opens the camera again; backing out of it returns to the live view. */}
            <button type="button" className="ps-btn" onClick={snap ? openSnap : rescan} style={{ height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#CBD5E1', fontWeight: 600 }}>
              {snap ? 'Retake' : 'Rescan'}
            </button>
            <button type="button" className="ps-btn" disabled={saving || (!draft.model.trim() && !draft.serial.trim())} onClick={save} style={{ height: 48, borderRadius: 12, fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', ...laserTileStyle(saving || (!draft.model.trim() && !draft.serial.trim()) ? 'off' : 'cyan') }}>
              {saving ? 'Saving…' : 'Save to job'}
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
