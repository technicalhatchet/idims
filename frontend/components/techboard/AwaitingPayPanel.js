import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { techWorkOrderDetailPath } from '../../lib/techRoutes';
import { logPayLinkSend } from '../../services/api/squarePayApi';
import { ageLabel, ageTone, formatMoney, payLinkSmsUrl } from '../../utils/awaitingPayment';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SHOW = 3;
const YELLOW = '#FACC15';

/* Same fold / ignite / scan as CriticalMassPanel, in yellow (own app-* classes). */
const PANEL_CSS = `
@keyframes app-ignite{0%{transform:scaleX(0);opacity:0}25%{opacity:1}100%{transform:scaleX(1);opacity:1}}
@keyframes app-row{0%{opacity:0;transform:translate3d(-10px,0,0)}100%{opacity:1;transform:translate3d(0,0,0)}}
@keyframes app-scan{0%{transform:translate3d(0,-100%,0)}100%{transform:translate3d(0,400%,0)}}
@keyframes app-seam{0%{left:-6px;opacity:1}80%{opacity:1}100%{left:calc(100% + 2px);opacity:0}}
@keyframes app-skel{0%,100%{opacity:.45}50%{opacity:.8}}
.app-fold{display:grid;grid-template-rows:0fr;transition:grid-template-rows .42s cubic-bezier(.2,.85,.25,1)}
.app-fold.is-open{grid-template-rows:1fr}
.app-fold.is-closing{transition-duration:.26s;transition-timing-function:cubic-bezier(.5,0,.75,0)}
.app-ignite{transform-origin:50% 50%;animation:app-ignite .18s cubic-bezier(.3,.7,.3,1) both}
.app-row{animation:app-row .26s cubic-bezier(.2,.9,.3,1) both}
.app-scan{animation:app-scan .9s cubic-bezier(.45,.05,.55,.95) .25s 1 both}
.app-seam{position:absolute;top:0;bottom:0;width:3px;background:#fff;box-shadow:0 0 8px #fff,0 0 18px ${YELLOW};pointer-events:none;animation:app-seam .3s cubic-bezier(.5,0,.3,1) both}
.app-skel{animation:app-skel 1.2s ease-in-out infinite}
.app-tap:focus-visible{outline:2px solid #FDE68A;outline-offset:2px}
@media (prefers-reduced-motion: reduce){
  .app-fold{transition:none}
  .app-root *{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important}
}
`;

function Row({ item, index }) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tone = ageTone(item.days_open);
  const href = techWorkOrderDetailPath(item.id);
  const sms = payLinkSmsUrl(item);

  return (
    <div className="app-row flex items-stretch gap-2" style={{ animationDelay: `${0.24 + index * 0.05}s` }}>
      <Link
        href={href}
        className="app-tap relative flex min-h-[60px] min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden rounded-[10px] px-3 py-2 touch-manipulation"
        style={pressed
          ? { border: '1px solid rgba(253, 230, 138, 0.9)', background: 'rgba(250, 204, 21, 0.14)', boxShadow: '0 0 16px rgba(250, 204, 21, 0.35)' }
          : { border: `1px solid ${tone.hot ? 'rgba(248,113,113,0.4)' : 'rgba(250, 204, 21, 0.25)'}`, background: 'rgba(13, 12, 20, 0.78)', transition: 'border-color .2s, background .2s' }}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          setPressed(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => router.push(href), 220);
        }}
      >
        <span className="flex items-center gap-2">
          <span
            className="shrink-0 rounded-[5px] px-1.5 py-0.5"
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#1A1200',
              background: tone.hot ? 'linear-gradient(180deg, #FCA5A5, #EF4444)' : 'linear-gradient(180deg, #FDE68A, #FACC15)',
            }}
          >
            {ageLabel(item.days_open)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#FDE68A' }}>#{item.order_number}</span>
          <span className="ml-auto whitespace-nowrap" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: '#FDE68A' }}>
            {formatMoney(item.balance_due)}
          </span>
        </span>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">{item.client}</span>
          <span className="shrink-0 whitespace-nowrap text-xs capitalize text-[#8A99AE]">{item.appliance}</span>
        </span>
        {pressed ? <span className="app-seam" aria-hidden="true" /> : null}
      </Link>
      {sms ? (
        <a
          href={sms}
          onClick={() => logPayLinkSend(item.id, 'text')}
          aria-label={`Text pay link to ${item.client}`}
          className="app-tap grid w-12 shrink-0 place-items-center rounded-[10px] touch-manipulation"
          style={{ border: '1px solid rgba(34, 211, 238, 0.35)', background: 'rgba(13, 22, 38, 0.8)', color: '#8FE6F3' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

/** Panel under the Awaiting Pay tile: the oldest money owed, with a way into the full list. */
export default function AwaitingPayPanel({ id, open, closing, data, loading, error, onRetry, onOpenList }) {
  const items = data?.items || [];
  const shown = items.slice(0, SHOW);
  const more = Math.max(0, items.length - shown.length);

  return (
    <div className={`app-root app-fold${open ? ' is-open' : ''}${closing ? ' is-closing' : ''}`}>
      <style>{PANEL_CSS}</style>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        <div
          id={id}
          className="relative overflow-hidden"
          style={{
            border: '1px solid rgba(250, 204, 21, 0.6)', borderTop: 0, borderRadius: '0 0 0.5rem 0.5rem',
            background: 'linear-gradient(180deg, rgba(36, 30, 8, 0.92) 0%, rgba(14, 13, 16, 0.95) 60%)',
          }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, rgba(250, 204, 21, 0.04) 0 1px, transparent 1px 4px)' }} />
          <div aria-hidden="true" className="app-scan pointer-events-none absolute inset-x-0 top-0" style={{ height: '30%', background: 'linear-gradient(180deg, rgba(253,230,138,0), rgba(253,230,138,0.12), rgba(253,230,138,0))' }} />
          <div aria-hidden="true" className="app-ignite absolute inset-x-0 top-0" style={{ height: 2, background: 'linear-gradient(90deg, rgba(255,240,180,0), #FFF1C2 15%, #FFFFFF 50%, #FFF1C2 85%, rgba(255,240,180,0))', boxShadow: `0 0 8px ${YELLOW}, 0 0 18px ${YELLOW}` }} />

          <div className="relative px-3 pb-3.5 pt-3">
            <div className="app-row mx-0.5 mb-2.5 flex items-center justify-between" style={{ animationDelay: '.18s' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#FDE68A' }}>
                {loading ? 'AWAITING PAY // SCANNING…' : `AWAITING PAY // ${formatMoney(data?.total_due || 0)}`}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#8A7E4A' }}>OLDEST FIRST</span>
            </div>

            {loading ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading jobs awaiting payment">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="app-skel h-[60px] rounded-[10px]" style={{ border: '1px solid rgba(250,204,21,0.18)', background: 'rgba(13,12,20,0.6)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 rounded-[10px] px-3 py-3 text-sm text-[#FECACA]" style={{ border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.14)' }}>
                <span className="flex-1">Couldn’t load who owes.</span>
                <button type="button" onClick={onRetry} className="app-tap min-h-[44px] rounded-lg px-3 font-semibold text-[#FDE68A]" style={{ border: '1px solid rgba(250,204,21,0.45)' }}>
                  Retry
                </button>
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-[10px] px-3 py-3 text-sm text-[#9CA3AF]" style={{ border: '1px solid rgba(250,204,21,0.2)' }}>
                Nobody owes right now.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {shown.map((item, i) => <Row key={item.id} item={item} index={i} />)}
              </div>
            )}

            <div className="app-row mt-3 flex items-center gap-2.5" style={{ animationDelay: '.5s' }}>
              {more > 0 ? (
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: '#8A7E4A' }}>+{more} MORE</span>
              ) : null}
              <button
                type="button"
                onClick={onOpenList}
                className="app-tap ml-auto flex min-h-[44px] items-center gap-2 rounded-[10px] px-3.5 text-xs font-bold tracking-[0.04em] touch-manipulation"
                style={{ border: '1px solid rgba(250, 204, 21, 0.5)', background: 'rgba(34, 30, 10, 0.85)', color: '#FDE68A' }}
              >
                Open full list
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <div aria-hidden="true" className="absolute inset-x-0 bottom-0" style={{ height: 2, background: YELLOW, boxShadow: `0 0 8px ${YELLOW}, 0 0 18px rgba(250, 204, 21, 0.7)` }} />
        </div>
      </div>
    </div>
  );
}
