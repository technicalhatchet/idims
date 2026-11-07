import { useEffect, useRef, useState } from 'react';
import FoldBox from './FoldBox';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { techWorkOrderDetailPath } from '../../lib/techRoutes';
import {
  criticalMassApplianceLabel,
  criticalMassClientLabel,
  criticalMassPhone,
  daysOverdue,
  overdueTag,
} from '../../utils/criticalMass';
import { workOrderStatusLabel } from '../../utils/workOrderStatusOptions';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SHOW = 5;

const PANEL_CSS = `
@keyframes cmp-ignite{0%{transform:scaleX(0);opacity:0}25%{opacity:1}100%{transform:scaleX(1);opacity:1}}
@keyframes cmp-row{0%{opacity:0;transform:translate3d(-10px,0,0)}100%{opacity:1;transform:translate3d(0,0,0)}}
@keyframes cmp-tag{0%{opacity:0}20%{opacity:1}35%{opacity:.3}50%{opacity:1}65%{opacity:.6}100%{opacity:1}}
@keyframes cmp-scan{0%{transform:translate3d(0,-100%,0)}100%{transform:translate3d(0,400%,0)}}
@keyframes cmp-seam{0%{transform:translate3d(-6px,0,0);opacity:1}80%{opacity:1}100%{transform:translate3d(var(--seam-w,320px),0,0);opacity:0}}
@keyframes cmp-skel{0%,100%{opacity:.45}50%{opacity:.8}}
.cmp-ignite{transform-origin:50% 50%;animation:cmp-ignite .18s cubic-bezier(.3,.7,.3,1) both}
.cmp-row{animation:cmp-row .26s cubic-bezier(.2,.9,.3,1) both}
.cmp-tag{animation:cmp-tag .5s linear both}
.cmp-scan{animation:cmp-scan .9s cubic-bezier(.45,.05,.55,.95) .25s 1 both}
.cmp-seam{position:absolute;left:0;top:0;bottom:0;width:3px;will-change:transform;background:#fff;box-shadow:0 0 8px #fff,0 0 18px #FB923C;pointer-events:none;animation:cmp-seam .3s cubic-bezier(.5,0,.3,1) both}
.cmp-skel{animation:cmp-skel 1.2s ease-in-out infinite}
.cmp-tap:focus-visible{outline:2px solid #FDBA74;outline-offset:2px}
@media (prefers-reduced-motion: reduce){
    .cmp-root *{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important}
}
`;

function Row({ wo, index, now }) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const days = daysOverdue(wo, now);
  const hot = days >= 7;
  const phone = criticalMassPhone(wo);
  const href = techWorkOrderDetailPath(wo.id);

  return (
    <div className="cmp-row flex items-stretch gap-2" style={{ animationDelay: `${0.24 + index * 0.05}s` }}>
      <Link
        href={href}
        className="cmp-tap relative flex min-h-[64px] min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden rounded-[10px] px-3 py-2 touch-manipulation"
        style={pressed
          ? { border: '1px solid rgba(255, 200, 150, 0.9)', background: 'rgba(251, 146, 60, 0.16)', boxShadow: '0 0 16px rgba(251, 146, 60, 0.4)' }
          : { border: '1px solid rgba(251, 146, 60, 0.28)', background: 'rgba(13, 12, 20, 0.78)', transition: 'border-color .2s, background .2s' }}
        onClick={(e) => {
          // Let new-tab / modified clicks through; otherwise show the seam, then go.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          setPressed(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => router.push(href), 220);
        }}
      >
        <span className="flex items-center gap-2">
          <span
            className="cmp-tag shrink-0 rounded-[5px] px-1.5 py-0.5"
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#1A0A00',
              background: hot ? 'linear-gradient(180deg, #FFB46B, #FB7A1F)' : '#FDBA74',
              animationDelay: `${0.34 + index * 0.05}s`,
            }}
          >
            {overdueTag(index, days)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#FDBA74' }}>#{wo.order_number}</span>
          <span
            className="ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#B8C7D6' }}
          >
            {workOrderStatusLabel(wo.status)}
          </span>
        </span>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">{criticalMassClientLabel(wo)}</span>
          <span className="shrink-0 whitespace-nowrap text-xs capitalize text-[#8A99AE]">{criticalMassApplianceLabel(wo)}</span>
        </span>
        {pressed ? <span className="cmp-seam" aria-hidden="true" /> : null}
      </Link>
      {phone ? (
        <a
          href={`tel:${phone}`}
          aria-label={`Call ${criticalMassClientLabel(wo)}`}
          className="cmp-tap grid w-12 shrink-0 place-items-center rounded-[10px] touch-manipulation"
          style={{ border: '1px solid rgba(34, 211, 238, 0.35)', background: 'rgba(13, 22, 38, 0.8)', color: '#8FE6F3' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

/**
 * The panel that slices open under the Critical Mass card: the most overdue jobs, worst
 * first, with a way into the full list. `open` drives the fold; `mounted` keeps it in the
 * DOM while it folds closed.
 */
export default function CriticalMassPanel({ id, open, closing, rows, total, loading, error, onRetry, onOpenList }) {
  const now = new Date();
  const shown = (rows || []).slice(0, SHOW);
  const more = Math.max(0, (total || 0) - shown.length);

  return (
    <FoldBox open={open} closing={closing} className="cmp-root">
      <style>{PANEL_CSS}</style>
      <div>
        <div
          id={id}
          className="relative overflow-hidden"
          style={{
            border: '1px solid rgba(251, 146, 60, 0.6)', borderTop: 0, borderRadius: '0 0 0.5rem 0.5rem',
            background: 'linear-gradient(180deg, rgba(40, 20, 10, 0.92) 0%, rgba(14, 12, 18, 0.95) 60%)',
          }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, rgba(251, 146, 60, 0.045) 0 1px, transparent 1px 4px)' }} />
          <div aria-hidden="true" className="cmp-scan pointer-events-none absolute inset-x-0 top-0" style={{ height: '30%', background: 'linear-gradient(180deg, rgba(255,180,107,0), rgba(255,180,107,0.12), rgba(255,180,107,0))' }} />
          <div aria-hidden="true" className="cmp-ignite absolute inset-x-0 top-0" style={{ height: 2, background: 'linear-gradient(90deg, rgba(255,200,150,0), #FFE2C2 15%, #FFFFFF 50%, #FFE2C2 85%, rgba(255,200,150,0))', boxShadow: '0 0 8px #FB923C, 0 0 18px #FB923C' }} />

          <div className="relative px-3 pb-3.5 pt-3">
            <div className="cmp-row mx-0.5 mb-2.5 flex items-center justify-between" style={{ animationDelay: '.18s' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#FDBA74' }}>
                {loading ? 'CRITICAL MASS // SCANNING…' : `CRITICAL MASS // ${total} OVERDUE`}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#8A6A52' }}>MOST OVERDUE FIRST</span>
            </div>

            {loading ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading overdue orders">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="cmp-skel h-16 rounded-[10px]" style={{ border: '1px solid rgba(251,146,60,0.18)', background: 'rgba(13,12,20,0.6)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 rounded-[10px] px-3 py-3 text-sm text-[#FECACA]" style={{ border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.14)' }}>
                <span className="flex-1">Couldn’t load the overdue list.</span>
                <button type="button" onClick={onRetry} className="cmp-tap min-h-[44px] rounded-lg px-3 font-semibold text-[#FDBA74]" style={{ border: '1px solid rgba(251,146,60,0.45)' }}>
                  Retry
                </button>
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-[10px] px-3 py-3 text-sm text-[#9CA3AF]" style={{ border: '1px solid rgba(251,146,60,0.2)' }}>
                Nothing overdue in your list right now.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {shown.map((wo, i) => <Row key={wo.id} wo={wo} index={i} now={now} />)}
              </div>
            )}

            <div className="cmp-row mt-3 flex items-center gap-2.5" style={{ animationDelay: '.52s' }}>
              {more > 0 ? (
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: '#8A6A52' }}>+{more} MORE</span>
              ) : null}
              <button
                type="button"
                onClick={onOpenList}
                className="cmp-tap ml-auto flex min-h-[44px] items-center gap-2 rounded-[10px] px-3.5 text-xs font-bold tracking-[0.04em] touch-manipulation"
                style={{ border: '1px solid rgba(251, 146, 60, 0.55)', background: 'rgba(40, 22, 12, 0.85)', color: '#FFB46B' }}
              >
                Open full list
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Glowing bottom edge: it rides down as the fold opens. */}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0" style={{ height: 2, background: '#FB923C', boxShadow: '0 0 8px #FB923C, 0 0 18px rgba(251, 146, 60, 0.7)' }} />
        </div>
      </div>
    </FoldBox>
  );
}
