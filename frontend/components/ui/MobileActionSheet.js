import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const CLOSE_MS = 230;
const BEVEL = 20;

const TONES = {
  default: {
    edge: '#A5F3FC',
    glow: '#22D3EE',
    kicker: '#5FB7C9',
    body: 'linear-gradient(180deg, rgba(16, 48, 66, 0.98) 0%, rgba(8, 16, 28, 0.99) 70%)',
    lines: 'rgba(34, 211, 238, 0.05)',
    scan: 'rgba(103, 232, 249, 0.12)',
  },
  danger: {
    edge: '#FCA5A5',
    glow: '#EF4444',
    kicker: '#F87171',
    body: 'linear-gradient(180deg, rgba(60, 14, 20, 0.98) 0%, rgba(14, 10, 18, 0.99) 70%)',
    lines: 'rgba(239, 68, 68, 0.05)',
    scan: 'rgba(248, 113, 113, 0.12)',
  },
};

/*
 * Laser sheet motion: the edge ignites from the centre, then rides up the sheet while the
 * body is revealed beneath it; closing reverses it back down into the bar.
 * Everything animates with transform / clip-path / opacity so it stays smooth on a phone.
 */
const SHEET_CSS = `
@keyframes lsheet-fade{0%{opacity:0}100%{opacity:1}}
@keyframes lsheet-fade-out{0%{opacity:1}100%{opacity:0}}
@keyframes lsheet-ignite{0%{transform:scaleX(0);opacity:0}20%{opacity:1}100%{transform:scaleX(1);opacity:1}}
@keyframes lsheet-flicker{0%,100%{opacity:1}30%{opacity:.35}45%{opacity:1}60%{opacity:.6}}
@keyframes lsheet-ride{0%{transform:translate3d(0,100%,0)}100%{transform:translate3d(0,0,0)}}
@keyframes lsheet-drop{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(0,100%,0)}}
@keyframes lsheet-reveal{0%{clip-path:inset(100% 0 0 0)}100%{clip-path:inset(0 0 0 0)}}
@keyframes lsheet-hide{0%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(100% 0 0 0)}}
@keyframes lsheet-scan{0%{transform:translate3d(0,-100%,0)}100%{transform:translate3d(0,260%,0)}}
@keyframes lsheet-row{0%{opacity:0;transform:translate3d(-8px,0,0)}100%{opacity:1;transform:translate3d(0,0,0)}}
@keyframes lsheet-seam{0%{left:-6px;opacity:1}80%{opacity:1}100%{left:calc(100% + 2px);opacity:0}}
.lsheet-backdrop{animation:lsheet-fade .25s ease-out both}
.lsheet-backdrop.is-out{animation:lsheet-fade-out .22s ease-in both}
.lsheet-body{animation:lsheet-reveal .38s cubic-bezier(.2,.85,.25,1) .12s both}
.lsheet-body.is-out{animation:lsheet-hide .22s cubic-bezier(.5,0,.75,0) both}
.lsheet-rider{animation:lsheet-ride .38s cubic-bezier(.2,.85,.25,1) .12s both;will-change:transform}
.lsheet-rider.is-out{animation:lsheet-drop .22s cubic-bezier(.5,0,.75,0) both}
.lsheet-edge{transform-origin:50% 50%;animation:lsheet-ignite .16s cubic-bezier(.3,.7,.3,1) both,lsheet-flicker .4s linear .55s 1}
.lsheet-scan{animation:lsheet-scan 1.1s cubic-bezier(.45,.05,.55,.95) .45s 1 both}
.lsheet-content>*{animation:lsheet-row .26s cubic-bezier(.2,.9,.3,1) .3s both}
.lsheet-content>*:nth-child(2){animation-delay:.34s}
.lsheet-content>*:nth-child(3){animation-delay:.38s}
.lsheet-content>*:nth-child(n+4){animation-delay:.42s}
.lsheet-stagger>*{animation:lsheet-row .26s cubic-bezier(.2,.9,.3,1) both}
.lsheet-stagger>*:nth-child(1){animation-delay:.3s}
.lsheet-stagger>*:nth-child(2){animation-delay:.35s}
.lsheet-stagger>*:nth-child(3){animation-delay:.4s}
.lsheet-stagger>*:nth-child(4){animation-delay:.45s}
.lsheet-stagger>*:nth-child(5){animation-delay:.5s}
.lsheet-stagger>*:nth-child(6){animation-delay:.55s}
.lsheet-stagger>*:nth-child(n+7){animation-delay:.6s}
.lsheet-seam{position:absolute;top:0;bottom:0;width:3px;background:#fff;pointer-events:none;animation:lsheet-seam .3s cubic-bezier(.5,0,.3,1) both}
.lsheet-row{position:relative;overflow:hidden;transition:border-color .2s,background-color .2s,box-shadow .2s,transform .15s}
.lsheet-row:active:not(:disabled){transform:scale(.99)}
.lsheet-row>svg{color:var(--lsheet-icon);opacity:.95}
.lsheet-row:focus-visible,.lsheet-close:focus-visible{outline:2px solid #A5F3FC;outline-offset:2px}
@media (prefers-reduced-motion: reduce){
  .lsheet-root *{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important}
}
`;

/** Bevelled laser edge across the top of the sheet. */
function LaserEdge({ tone }) {
  const t = TONES[tone] || TONES.default;
  const corner = (flip) => (
    <svg
      width={BEVEL}
      height={BEVEL}
      viewBox={`0 0 ${BEVEL} ${BEVEL}`}
      style={{ position: 'absolute', top: 0, [flip ? 'right' : 'left']: 0, overflow: 'visible', transform: flip ? 'scaleX(-1)' : 'none' }}
      aria-hidden="true"
      fill="none"
    >
      <path d={`M0 ${BEVEL} L${BEVEL} 0`} stroke={t.glow} strokeOpacity="0.45" strokeWidth="7" style={{ filter: 'blur(5px)' }} />
      <path d={`M0 ${BEVEL} L${BEVEL} 0`} stroke={t.edge} strokeWidth="1.5" />
    </svg>
  );
  return (
    <div className="lsheet-edge" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BEVEL }}>
      {corner(false)}
      {corner(true)}
      <span style={{ position: 'absolute', left: BEVEL, right: BEVEL, top: -3, height: 7, background: t.glow, opacity: 0.45, filter: 'blur(5px)' }} />
      <span style={{ position: 'absolute', left: BEVEL, right: BEVEL, top: -0.5, height: 1.5, background: t.edge }} />
      <span style={{ position: 'absolute', left: BEVEL + 8, right: BEVEL + 8, top: -1, height: 2, background: '#FFFFFF' }} />
      <span style={{ position: 'absolute', left: '38%', right: '38%', top: 6, height: 2, borderRadius: 2, background: t.edge, opacity: 0.55 }} />
    </div>
  );
}

/**
 * Laser bottom sheet portaled to document.body (bypasses hud-grid-content
 * pointer-events:none used for the tactical grid double-tap).
 *
 * kicker: small mono line above the title (e.g. "WO #1042 // ACTIONS").
 * tone:   'default' (cyan) or 'danger' (red, for destructive confirms).
 * fill:   the content manages its own scrolling (e.g. a list that scrolls above a pinned
 *         footer); the sheet still sizes to its content up to 88vh.
 */
export default function MobileActionSheet({
  open,
  onClose,
  title,
  kicker = null,
  tone = 'default',
  fill = false,
  children,
  zIndex = 20000,
}) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      setClosing(true);
      timer.current = setTimeout(() => {
        setRendered(false);
        setClosing(false);
      }, CLOSE_MS);
    }
    return () => clearTimeout(timer.current);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rendered || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [rendered]);

  if (!rendered || typeof document === 'undefined') return null;

  const t = TONES[tone] || TONES.default;
  const out = closing ? ' is-out' : '';
  const bevelClip = `polygon(0 ${BEVEL}px, ${BEVEL}px 0, calc(100% - ${BEVEL}px) 0, 100% ${BEVEL}px, 100% 100%, 0 100%)`;

  return createPortal(
    <div
      className="lsheet-root fixed inset-0 flex flex-col justify-end touch-manipulation"
      style={{ zIndex }}
      role="presentation"
    >
      <style>{SHEET_CSS}</style>
      <button
        type="button"
        className={`lsheet-backdrop absolute inset-0${out}`}
        style={{ background: 'rgba(2, 6, 12, 0.66)' }}
        onClick={closing ? undefined : onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        className="relative z-[1] w-full"
        style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'mobile-action-sheet-title' : undefined}
      >
        <div className={`lsheet-body relative flex min-h-0 flex-1 flex-col${out}`}>
          {/* Background carries the bevel; the reveal animation lives on the parent. */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', clipPath: bevelClip, WebkitClipPath: bevelClip, background: t.body, pointerEvents: 'none' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(0deg, ${t.lines} 0 1px, transparent 1px 4px)` }} />
            <div
              className="lsheet-scan"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '40%', background: `linear-gradient(180deg, rgba(255,255,255,0), ${t.scan}, rgba(255,255,255,0))` }}
            />
          </div>
          <div
            className={`relative flex min-h-0 flex-1 flex-col px-4 ${fill ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}
            style={{ paddingTop: 22, paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {title || kicker ? (
              <div className="mb-3 flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
                <div className="min-w-0">
                  {kicker ? (
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: t.kicker }}>
                      {kicker}
                    </div>
                  ) : null}
                  {title ? (
                    <h2 id="mobile-action-sheet-title" className="text-[17px] font-bold leading-snug text-[#ECFEFF]" style={{ marginTop: kicker ? 3 : 0 }}>
                      {title}
                    </h2>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="lsheet-close grid shrink-0 place-items-center rounded-xl touch-manipulation"
                  style={{ width: 44, height: 44, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(13,22,38,0.8)', color: '#B8C7D6' }}
                  onClick={closing ? undefined : onClose}
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ) : null}
            <div className={`lsheet-content${fill ? ' flex min-h-0 flex-1 flex-col' : ''}`}>{children}</div>
          </div>
        </div>
        {/* The edge rides the reveal boundary: same timing, translated by the sheet's own height. */}
        <div aria-hidden="true" className={`lsheet-rider pointer-events-none absolute inset-0${out}`}>
          <LaserEdge tone={tone} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Show the laser seam, then run the action (so the press reads before the sheet closes). */
function useSeamThenRun(delayMs = 220) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = useCallback((fn) => {
    clearTimeout(timer.current);
    setPressed(true);
    timer.current = setTimeout(() => {
      setPressed(false);
      fn?.();
    }, delayMs);
  }, [delayMs]);
  return [pressed, run];
}

const ROW_TONES = {
  default: { border: 'rgba(34, 211, 238, 0.22)', bg: 'rgba(13, 22, 38, 0.72)', color: '#E6F6FA', icon: '#67E8F9', seam: '#22D3EE' },
  primary: { border: 'rgba(34, 211, 238, 0.55)', bg: 'rgba(34, 211, 238, 0.12)', color: '#CFFAFE', icon: '#67E8F9', seam: '#22D3EE' },
  danger: { border: 'rgba(248, 113, 113, 0.4)', bg: 'rgba(127, 29, 29, 0.18)', color: '#FECACA', icon: '#FCA5A5', seam: '#EF4444' },
};

export function MobileActionSheetGridTile({
  icon,
  label,
  onClick,
  disabled = false,
  ...props
}) {
  const [pressed, run] = useSeamThenRun();
  return (
    <button
      type="button"
      className="lsheet-row flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 touch-manipulation disabled:pointer-events-none disabled:opacity-40"
      style={{
        border: `1px solid ${pressed ? 'rgba(165, 243, 252, 0.85)' : 'rgba(34, 211, 238, 0.22)'}`,
        background: pressed ? 'rgba(34, 211, 238, 0.16)' : 'rgba(13, 22, 38, 0.72)',
        boxShadow: pressed ? '0 0 16px rgba(34, 211, 238, 0.35)' : 'none',
      }}
      onClick={(e) => {
        if (!onClick) return;
        e.persist?.();
        run(() => onClick(e));
      }}
      disabled={disabled}
      {...props}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-[10px] [&>svg]:h-6 [&>svg]:w-6"
        style={{ color: '#67E8F9', background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)', filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.35))' }}
      >
        {icon}
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight text-[#D5E6EE]">{label}</span>
      {pressed ? <span className="lsheet-seam" style={{ boxShadow: '0 0 8px #fff, 0 0 18px #22D3EE' }} aria-hidden="true" /> : null}
    </button>
  );
}

export function MobileActionSheetButton({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  href,
  as: Component = 'button',
  ...props
}) {
  const [pressed, run] = useSeamThenRun();
  const t = ROW_TONES[variant] || ROW_TONES.default;
  const className =
    'lsheet-row flex w-full min-h-[52px] items-center gap-3 rounded-xl px-4 text-[15px] font-semibold touch-manipulation disabled:opacity-40 [&>svg]:shrink-0';
  const style = {
    color: t.color,
    border: `1px solid ${pressed ? 'rgba(165, 243, 252, 0.85)' : t.border}`,
    background: pressed ? 'rgba(34, 211, 238, 0.16)' : t.bg,
    boxShadow: pressed ? `0 0 16px ${variant === 'danger' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 211, 238, 0.35)'}` : 'none',
    '--lsheet-icon': t.icon,
  };
  const seam = pressed ? (
    <span className="lsheet-seam" style={{ boxShadow: `0 0 8px #fff, 0 0 18px ${t.seam}` }} aria-hidden="true" />
  ) : null;

  if (href) {
    // Links navigate right away (no delayed seam) so long-press / open-in-new-tab still work.
    return (
      <a href={href} className={className} style={style} onClick={onClick} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Component
      type="button"
      className={className}
      style={style}
      onClick={(e) => {
        if (!onClick) return;
        e.persist?.();
        run(() => onClick(e));
      }}
      disabled={disabled}
      {...props}
    >
      {children}
      {seam}
    </Component>
  );
}
