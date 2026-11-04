import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDmaEquipment } from '../../constants/dmaEquipmentOptions';
import { DmaTagPills } from './DmaTagPicker';
import { dossierRows, dossierStamp, dossierTag } from '../../utils/dmaDossier';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SCRAMBLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const CLOSE_MS = 300;

const DOSSIER_CSS = `
@keyframes dm-cut{0%{transform:scaleX(0);opacity:0}25%{opacity:1}100%{transform:scaleX(1);opacity:1}}
@keyframes dm-flap{0%{transform:perspective(900px) rotateX(-88deg);opacity:0}30%{opacity:1}100%{transform:perspective(900px) rotateX(0);opacity:1}}
@keyframes dm-flap-close{0%{transform:perspective(900px) rotateX(0);opacity:1}100%{transform:perspective(900px) rotateX(-88deg);opacity:0}}
@keyframes dm-row{0%{opacity:0;transform:translate3d(-8px,0,0)}100%{opacity:1;transform:translate3d(0,0,0)}}
@keyframes dm-tab{0%{transform:translate3d(0,6px,0);opacity:0}100%{transform:translate3d(0,0,0);opacity:1}}
@keyframes dm-scan{0%{transform:translate3d(0,-100%,0)}100%{transform:translate3d(0,500%,0)}}
@keyframes dm-stamp{0%{transform:scale(1.6) rotate(-14deg);opacity:0}60%{transform:scale(.95) rotate(-8deg);opacity:1}100%{transform:scale(1) rotate(-8deg);opacity:1}}
.dm-fold{display:grid;grid-template-rows:0fr;transition:grid-template-rows .46s cubic-bezier(.2,.85,.25,1)}
.dm-fold.is-open{grid-template-rows:1fr}
.dm-fold.is-closing{transition-duration:.28s;transition-timing-function:cubic-bezier(.5,0,.75,0)}
.dm-cut{transform-origin:0 50%;animation:dm-cut .2s cubic-bezier(.3,.7,.3,1) both}
.dm-flap{transform-origin:50% 0;animation:dm-flap .5s cubic-bezier(.2,.85,.25,1) .08s both}
.dm-flap.is-out{animation:dm-flap-close .26s cubic-bezier(.5,0,.75,0) both}
.dm-row{animation:dm-row .26s cubic-bezier(.2,.9,.3,1) both}
.dm-tab{animation:dm-tab .22s cubic-bezier(.2,.9,.3,1.2) both}
.dm-scan{animation:dm-scan 1s cubic-bezier(.45,.05,.55,.95) .3s 1 both}
.dm-stamp{animation:dm-stamp .35s cubic-bezier(.2,.9,.3,1.3) .6s both}
.dm-tap:focus-visible{outline:2px solid #FDBA74;outline-offset:2px}
@media (prefers-reduced-motion: reduce){
  .dm-fold{transition:none}
  .dm-root *{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important}
}
`;

/** The confirmed fix "decodes" into place, like the scanner readouts. */
function useDecode(target, active) {
  const [shown, setShown] = useState(active ? '' : target);
  useEffect(() => {
    if (!active || !target) {
      setShown(target || '');
      return undefined;
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(target);
      return undefined;
    }
    let frame = 0;
    const total = 16;
    let id = null;
    const start = setTimeout(() => {
      id = setInterval(() => {
        frame += 1;
        const settled = Math.floor((frame / total) * target.length);
        setShown(target.split('').map((c, i) => (i < settled || c === ' ' ? c : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)])).join(''));
        if (frame >= total) {
          clearInterval(id);
          setShown(target);
        }
      }, 32);
    }, 340);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [target, active]);
  return shown;
}

/**
 * A Repair Memory search result that unfolds into a dossier in place: an orange laser cuts
 * along its top, the error code becomes a folder tab, and the dossier flap swings down.
 * Controlled: the page keeps one open at a time.
 */
export default function DmaDossierCard({ item, href, open, onToggle, sourceBadge, problemOptions, resolutionOptions }) {
  const [mounted, setMounted] = useState(open);
  const [unfolded, setUnfolded] = useState(open);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  const panelId = `dossier-${item.source_type}-${item.id}`;

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setClosing(false);
      setMounted(true);
      // Mount folded, then unfold on the next frames so the height can animate.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setUnfolded(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    if (mounted) {
      setUnfolded(false);
      setClosing(true);
      timer.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, CLOSE_MS);
    }
    return () => clearTimeout(timer.current);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fix = useDecode(String(item.confirmed_fix || '').toUpperCase(), open && unfolded);
  const rows = mounted ? dossierRows(item, { problemOptions, resolutionOptions }) : [];
  const stamp = dossierStamp(item);
  const stampColor = stamp.tone === 'green' ? '#6EE7B7' : '#FB923C';
  const isField = item.source_type === 'field_record';

  return (
    <div className="dm-root relative" style={{ paddingTop: mounted ? 24 : 0, transition: 'padding-top .2s' }}>
      <style>{DOSSIER_CSS}</style>
      {mounted ? (
        <div
          className="dm-tab absolute left-0 top-0 flex h-6 items-center pl-2.5 pr-3"
          style={{
            borderRadius: '8px 8px 0 0',
            background: 'linear-gradient(180deg, #FFB46B, #FB7A1F)',
            color: '#1A0A00',
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)',
          }}
        >
          {dossierTag(item)}
        </div>
      ) : null}

      <div
        className="relative overflow-hidden bg-[#0D1525]"
        style={{
          borderRadius: mounted ? '0 12px 12px 12px' : 12,
          border: `1px solid ${mounted ? 'rgba(251, 146, 60, 0.7)' : 'rgba(255, 255, 255, 0.1)'}`,
          transition: 'border-color .25s, border-radius .25s',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="dm-tap block w-full p-4 text-left touch-manipulation"
        >
          <span className="mb-2 flex flex-wrap items-center gap-2">
            {sourceBadge}
            {!item.repair_successful && (
              <span className="text-[10px] uppercase tracking-wide text-orange-400">Unsuccessful</span>
            )}
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FDBA74"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-auto"
              style={{ transition: 'transform .3s cubic-bezier(.2,.9,.3,1.2)', transform: open ? 'rotate(180deg)' : 'none' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
          <span className="block text-sm font-medium text-white">{formatDmaEquipment(item)}</span>
          {item.error_code_text && (
            <span className="mt-1 block text-xs text-orange-300">Code: {item.error_code_text}</span>
          )}
          <span className="mt-2 block text-sm text-gray-200">{item.confirmed_fix}</span>
          {!mounted && item.tags?.length ? (
            <span className="mt-2 block"><DmaTagPills tags={item.tags} /></span>
          ) : null}
        </button>
        {mounted ? (
          <div
            aria-hidden="true"
            className="dm-cut pointer-events-none absolute inset-x-0 top-0 h-0.5"
            style={{ background: 'linear-gradient(90deg, #FFFFFF, #FFE2C2 20%, #FB923C 80%, rgba(251,146,60,0))', boxShadow: '0 0 8px #FB923C, 0 0 16px rgba(251,146,60,0.7)' }}
          />
        ) : null}

        <div className={`dm-fold${unfolded ? ' is-open' : ''}${closing ? ' is-closing' : ''}`}>
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            {mounted ? (
              <div
                id={panelId}
                className={`dm-flap relative mx-2.5 mb-3 overflow-hidden rounded-[10px]${closing ? ' is-out' : ''}`}
                style={{ border: '1px solid rgba(251, 146, 60, 0.35)', background: 'linear-gradient(180deg, rgba(36, 22, 14, 0.96), rgba(16, 13, 18, 0.98))' }}
              >
                <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, rgba(251,146,60,0.04) 0 1px, transparent 1px 4px)' }} />
                <div aria-hidden="true" className="dm-scan pointer-events-none absolute inset-x-0 top-0" style={{ height: '22%', background: 'linear-gradient(180deg, rgba(255,180,107,0), rgba(255,180,107,0.12), rgba(255,180,107,0))' }} />
                <div
                  aria-hidden="true"
                  className="dm-stamp pointer-events-none absolute right-3 top-3 rounded-md px-2 py-0.5"
                  style={{ border: `2px solid ${stampColor}`, color: stampColor, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', opacity: 0.85 }}
                >
                  {stamp.label}
                </div>

                <div className="relative flex flex-col gap-2.5 px-3.5 pb-3 pt-3.5">
                  <div className="dm-row pr-24" style={{ animationDelay: '.26s' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#B9875F' }}>{'CONFIRMED FIX //'}</div>
                    <div className="mt-0.5 break-words" style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: '#FFB46B', lineHeight: 1.3 }} aria-label={item.confirmed_fix}>
                      {fix || ' '}
                    </div>
                  </div>
                  {rows.map((r, j) => (
                    <div key={r.key} className="dm-row" style={{ animationDelay: `${0.31 + j * 0.05}s` }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#B9875F' }}>{`${r.label} //`}</div>
                      <div
                        className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug"
                        style={{ color: r.tone === 'green' ? '#6EE7B7' : r.tone === 'orange' ? '#FB923C' : '#D5E6EE' }}
                      >
                        {r.value}
                      </div>
                    </div>
                  ))}
                  {item.tags?.length ? (
                    <div className="dm-row" style={{ animationDelay: `${0.31 + rows.length * 0.05}s` }}>
                      <DmaTagPills tags={item.tags} />
                    </div>
                  ) : null}
                  <div className="dm-row mt-0.5 flex items-center gap-2" style={{ animationDelay: `${0.36 + rows.length * 0.05}s` }}>
                    {item.order_number && !isField ? (
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: '#8A6A52' }}>WO #{item.order_number}</span>
                    ) : null}
                    <Link
                      href={href}
                      className="dm-tap ml-auto flex min-h-[44px] items-center gap-2 rounded-[10px] px-3.5 text-xs font-bold touch-manipulation"
                      style={{ border: '1px solid rgba(251, 146, 60, 0.55)', background: 'rgba(40, 22, 12, 0.85)', color: '#FFB46B' }}
                    >
                      {isField ? 'Open full record' : 'Open work order'}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
