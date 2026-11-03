import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LaserIcon, laserTileStyle } from '../navigation/LaserBarParts';
import { createBarcodeEngine, createOcrEngine, grabRegion } from '../../lib/plateScanEngines';
import { PlateReadTracker } from '../../utils/plateParse';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const BARCODE_EVERY_MS = 140;
const OCR_EVERY_MS = 700;
const SCRAMBLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

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
 * Full-screen rating-plate scanner. Barcode and text readers run together on the live
 * camera; whichever reads a field first (barcode wins ties) locks it.
 *
 * onSave({ model, serial, photo }) — photo is a JPEG Blob of the plate (or null).
 */
export default function PlateScanner({ open, onClose, onSave, make = '', initialModel = '', initialSerial = '' }) {
  const videoRef = useRef(null);
  const boxRef = useRef(null);
  const canvasBarRef = useRef(null);
  const canvasOcrRef = useRef(null);
  const trackerRef = useRef(null);
  const streamRef = useRef(null);
  const runningRef = useRef(false);
  const ocrRef = useRef(null);

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
  const scanStartRef = useRef(0);

  const publish = useCallback((justLocked = []) => {
    const snap = trackerRef.current.snapshot();
    setFields(snap);
    if (justLocked.length) {
      setFlash((n) => n + 1);
      try { navigator.vibrate?.(35); } catch { /* not supported */ }
    }
    return snap;
  }, []);

  const capturePhoto = useCallback(() => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const c = document.createElement('canvas');
    const scale = Math.min(1, 1600 / v.videoWidth);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => b && setPhoto(b), 'image/jpeg', 0.85);
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
    runningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start camera + engines.
  const start = useCallback(async () => {
    setPhase('starting');
    setError(null);
    setHits([]);
    trackerRef.current = new PlateReadTracker({ make });
    setFields(trackerRef.current.snapshot());

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
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() || {};
      setTorch({ supported: Boolean(caps.torch), on: false });
      try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch { /* optional */ }
    } catch (e) {
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
    setBarcodeKind(barcode.kind);
    (async function loop() {
      while (runningRef.current) {
        const v = videoRef.current;
        const box = boxRef.current;
        const rect = v && box ? guideToVideoRect(v, box) : null;
        const canvas = rect && grabRegion(v, rect, canvasBarRef.current, { maxWidth: 1800 });
        const began = performance.now();
        if (canvas) {
          try {
            const found = await barcode.decode(canvas);
            if (found.length && runningRef.current) {
              const bw = box.clientWidth / canvas.width;
              const bh = box.clientHeight / canvas.height;
              // 1D readers report a scan line, so grow it into a target box around the code.
              setHits(found.filter((f) => f.box).map((f, i) => {
                const w = f.box.w * bw;
                const h = Math.max(f.box.h * bh, w * 0.28);
                const cy = (f.box.y + f.box.h / 2) * bh;
                return { id: `${Date.now()}-${i}`, x: f.box.x * bw, y: cy - h / 2, w, h };
              }));
              let locked = [];
              for (const f of found) locked = locked.concat(trackerRef.current.addBarcode(f.text));
              const snap = publish(locked);
              if (snap.done) {
                setTimeout(() => runningRef.current && goConfirm(), 650);
                return;
              }
            }
          } catch { /* keep scanning */ }
        }
        // Pace by how long a pass took so the phone's main thread (and the text
        // reader) always gets breathing room on slower devices.
        const spent = performance.now() - began;
        await new Promise((r) => setTimeout(r, Math.max(BARCODE_EVERY_MS, spent * 1.5)));
      }
    }());

    // OCR loop (slower), starts once the text engine has loaded.
    (async function ocrLoop() {
      try {
        if (!ocrRef.current) {
          ocrRef.current = await createOcrEngine((p) => setOcrStatus((s) => ({ ...s, progress: p })));
        }
        setOcrStatus({ ready: true, progress: 1, failed: false });
      } catch {
        setOcrStatus({ ready: false, progress: 0, failed: true });
        return;
      }
      while (runningRef.current) {
        const v = videoRef.current;
        const box = boxRef.current;
        const rect = v && box ? guideToVideoRect(v, box) : null;
        const canvas = rect && grabRegion(v, rect, canvasOcrRef.current, { maxWidth: 1000, enhance: true });
        if (canvas) {
          try {
            const text = await ocrRef.current.read(canvas);
            if (!runningRef.current) return;
            const locked = trackerRef.current.addOcr(text);
            const snap = publish(locked);
            // Text is visible but no barcode has locked after a few seconds: coach the user.
            const anyBarcode = snap.model.source === 'barcode' || snap.serial.source === 'barcode';
            if (!anyBarcode && Date.now() - scanStartRef.current > 3500 && /\S{4,}/.test(text)) {
              setHint('Barcode? Move closer so it fills the box');
            }
            if (snap.done) {
              setTimeout(() => runningRef.current && goConfirm(), 650);
              return;
            }
          } catch { /* keep scanning */ }
        }
        await new Promise((r) => setTimeout(r, OCR_EVERY_MS));
      }
    }());
  }, [make, publish, goConfirm]);

  useEffect(() => {
    if (!open) return undefined;
    setPhoto(null);
    setDraft({ model: initialModel, serial: initialSerial });
    start();
    return () => stopCamera();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release the text engine when the scanner is unmounted.
  useEffect(() => () => {
    stopCamera();
    ocrRef.current?.close?.();
    ocrRef.current = null;
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

  const rescan = () => {
    stopCamera();
    start();
  };

  const close = () => {
    stopCamera();
    onClose?.();
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave?.({ model: draft.model.trim().toUpperCase(), serial: draft.serial.trim().toUpperCase(), photo });
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
        @keyframes ps-sweep { 0% { top: 0% } 100% { top: 100% } }
        @keyframes ps-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0.35 } }
        @keyframes ps-pulse { 0%, 100% { opacity: 0.55 } 50% { opacity: 1 } }
        @keyframes ps-hit { 0% { opacity: 0; transform: scale(1.25) } 25% { opacity: 1; transform: scale(1) } 100% { opacity: 0; transform: scale(1) } }
        @keyframes ps-flash { 0% { opacity: 0.55 } 100% { opacity: 0 } }
        @keyframes ps-lock-pop { 0% { transform: scale(0.97) } 40% { transform: scale(1.02) } 100% { transform: scale(1) } }
        @keyframes ps-panel-in { 0% { transform: translateY(40px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes ps-boot { 0% { clip-path: inset(50% 0 50% 0) } 100% { clip-path: inset(0 0 0 0) } }
        .ps-blink { animation: ps-blink 1s steps(1) infinite; }
        .ps-lock-pop { animation: ps-lock-pop .35s cubic-bezier(.2,.9,.3,1.2); }
        .ps-sweep { animation: ps-sweep 1.6s cubic-bezier(.45,.05,.55,.95) infinite alternate; }
        .ps-sweep.ps-fast { animation-duration: 0.9s; }
        .ps-boot { animation: ps-boot .45s cubic-bezier(.2,.9,.25,1) both; }
        .ps-btn:focus-visible { outline: 2px solid #A5F3FC; outline-offset: 3px; }
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
      <canvas ref={canvasBarRef} style={{ display: 'none' }} />
      <canvas ref={canvasOcrRef} style={{ display: 'none' }} />

      {/* Top HUD */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, rgba(2,5,9,0.85), rgba(2,5,9,0))' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', color: '#67E8F9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: scanning ? '#F87171' : '#64748B', boxShadow: scanning ? '0 0 8px #F87171' : 'none' }} className={scanning ? 'ps-blink' : ''} />
            PLATE SCAN {scanning ? '// LIVE' : ''}
          </div>
          <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#5B7083' }}>
            BARCODE <span style={{ color: barcodeKind ? '#34D399' : '#64748B' }}>●</span>
            {'  '}TEXT{' '}
            {ocrStatus.failed ? (
              <span style={{ color: '#F87171' }}>OFF</span>
            ) : ocrStatus.ready ? (
              <span style={{ color: '#34D399' }}>●</span>
            ) : (
              <span style={{ color: '#FBBF24', animation: 'ps-pulse 1s infinite' }}>{ocrStatus.progress > 0.02 ? `${Math.round(ocrStatus.progress * 100)}%` : '…'}</span>
            )}
          </div>
        </div>
        <button type="button" className="ps-btn" aria-label="Close scanner" onClick={close} style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(13,22,38,0.8)', border: '1px solid rgba(255,255,255,0.16)', color: '#CBD5E1' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {/* Guide box */}
      <div
        ref={boxRef}
        style={{
          position: 'absolute',
          left: '7%',
          right: '7%',
          top: '22%',
          aspectRatio: '1.55 / 1',
          borderRadius: 14,
          boxShadow: '0 0 0 100vmax rgba(2,6,12,0.62)',
          opacity: phase === 'confirm' ? 0 : 1,
          transition: 'opacity .25s',
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
            <div className={`ps-sweep${anyValue ? ' ps-fast' : ''}`} style={{ position: 'absolute', left: 0, right: 0, height: 0 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, background: 'linear-gradient(180deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 64, background: 'linear-gradient(0deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.10) 60%, rgba(103,232,249,0.32) 100%)' }} />
              <div style={{ position: 'absolute', left: -4, right: -4, top: -1.5, height: 3, borderRadius: 2, background: 'linear-gradient(90deg, rgba(240,255,255,0), #F0FFFF 12%, #FFFFFF 50%, #F0FFFF 88%, rgba(240,255,255,0))', boxShadow: '0 0 8px #A5F3FC, 0 0 18px #22D3EE, 0 0 36px #22D3EE' }} />
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
          {phase === 'starting' ? 'STARTING CAMERA…' : bothLocked ? 'LOCKED' : (hint || 'LINE UP THE RATING PLATE').toUpperCase()}
        </div>
      </div>

      {/* Readouts + controls */}
      {phase !== 'confirm' && phase !== 'error' ? (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Readout label="MODEL" field={fields.model} />
          <Readout label="SERIAL" field={fields.serial} />
          <div style={{ display: 'grid', gridTemplateColumns: torch.supported ? '44px 1fr 1fr' : '1fr 1fr', gap: 8, marginTop: 6 }}>
            {torch.supported ? (
              <button type="button" className="ps-btn" aria-label={torch.on ? 'Turn light off' : 'Turn light on'} aria-pressed={torch.on} onClick={toggleTorch} style={{ height: 48, borderRadius: 12, display: 'grid', placeItems: 'center', border: '1px solid rgba(251,191,36,0.5)', background: torch.on ? '#FBBF24' : 'rgba(13,22,38,0.85)', color: torch.on ? '#1A1000' : '#FBBF24' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2h6l-1 7h4l-8 13 2-9H8z" /></svg>
              </button>
            ) : null}
            <button type="button" className="ps-btn" onClick={goConfirm} style={{ height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(13,22,38,0.85)', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>
              Type it
            </button>
            <button type="button" className="ps-btn" disabled={!anyValue} onClick={goConfirm} style={{ height: 48, borderRadius: 12, fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .25s', ...laserTileStyle(anyValue ? 'cyan' : 'off') }}>
              <LaserIcon name="scan" size={16} strokeWidth={2.1} /> Use these
            </button>
          </div>
        </div>
      ) : null}

      {/* Error state */}
      {phase === 'error' && error ? (
        <div style={{ position: 'absolute', left: 16, right: 16, top: '30%', padding: 18, borderRadius: 16, background: 'rgba(13,22,38,0.95)', border: '1px solid rgba(248,113,113,0.45)', animation: 'ps-panel-in .3s both' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: '#F87171' }}>SCANNER OFFLINE</div>
          <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>{error.title}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#94A3B8' }}>{error.detail}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="button" className="ps-btn" onClick={rescan} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#CBD5E1', fontWeight: 600 }}>Try again</button>
            <button type="button" className="ps-btn" onClick={() => setPhase('confirm')} style={{ flex: 1, height: 46, borderRadius: 12, fontWeight: 800, ...laserTileStyle('cyan') }}>Type it</button>
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
            <button type="button" className="ps-btn" onClick={rescan} style={{ height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#CBD5E1', fontWeight: 600 }}>
              Rescan
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
