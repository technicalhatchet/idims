import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const TABS_CSS = `
@keyframes wotab-spark{0%{opacity:0;transform:translate(-50%,50%) scale(.3)}35%{opacity:1;transform:translate(-50%,50%) scale(1.25)}100%{opacity:0;transform:translate(-50%,50%) scale(.6)}}
@keyframes wotab-lock{0%{opacity:.4}30%{opacity:1}45%{opacity:.55}60%,100%{opacity:1}}
@keyframes wotab-pulse{0%,100%{opacity:.75}50%{opacity:1}}
.wotab-spark{animation:wotab-spark .42s cubic-bezier(.2,.8,.3,1) .16s both}
.wotab-lock{animation:wotab-lock .4s linear .14s both}
.wotab-core{animation:wotab-pulse 2.4s ease-in-out infinite}
.wotab-btn:focus-visible{outline:2px solid #A5F3FC;outline-offset:2px;border-radius:6px}
@media (prefers-reduced-motion: reduce){
  .wotab-root *{animation:none!important;transition:none!important}
}
`;

const EASE = 'cubic-bezier(.3,.8,.25,1)';

/**
 * Mobile work order tabs with a laser indicator. When the active tab changes the beam's
 * leading edge moves first and the tail catches up, a spark flashes where it lands, and the
 * active label locks on with a glow. The row scrolls to keep the active tab in view.
 * In normal document flow (not sticky/fixed).
 */
export default function WoMobileTextTabs({ items, activeId, onSelect, className = '' }) {
  const navRef = useRef(null);
  const trackRef = useRef(null);
  const tabRefs = useRef({});
  const prevIndex = useRef(-1);
  const [beam, setBeam] = useState({ left: 0, right: 0, ready: false, dir: 1 });
  const [spark, setSpark] = useState({ n: 0, x: 0 });
  const [edges, setEdges] = useState({ left: false, right: false });

  // Fade whichever edge has more tabs hidden behind it.
  const updateEdges = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const left = nav.scrollLeft > 4;
    const right = nav.scrollLeft < nav.scrollWidth - nav.clientWidth - 4;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  const activeIndex = items.findIndex((t) => t.id === activeId);

  const measure = useCallback(() => {
    const el = tabRefs.current[activeId];
    const track = trackRef.current;
    if (!el || !track) return null;
    const left = el.offsetLeft;
    const right = track.offsetWidth - (el.offsetLeft + el.offsetWidth);
    setBeam((b) => (b.left === left && b.right === right ? b : { ...b, left, right }));
    return { left, width: el.offsetWidth };
  }, [activeId]);

  // Place the beam on first paint, and only turn on the slide a frame later so it
  // doesn't sweep in from the left edge.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setBeam((b) => ({ ...b, ready: true })));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Tab change: set direction, move the beam, fire the spark, keep the tab in view.
  useIsoLayoutEffect(() => {
    const prev = prevIndex.current;
    prevIndex.current = activeIndex;
    if (prev === -1 || prev === activeIndex) {
      measure();
      return;
    }
    const dir = activeIndex > prev ? 1 : -1;
    setBeam((b) => ({ ...b, dir }));
    const pos = measure();
    if (pos) setSpark((s) => ({ n: s.n + 1, x: dir > 0 ? pos.left + pos.width : pos.left }));

    // Center the picked tab so its neighbours on both sides are visible.
    const nav = navRef.current;
    const el = tabRefs.current[activeId];
    if (nav && el) {
      const max = nav.scrollWidth - nav.clientWidth;
      const target = Math.max(0, Math.min(max, el.offsetLeft + el.offsetWidth / 2 - nav.clientWidth / 2));
      if (Math.abs(target - nav.scrollLeft) > 2) nav.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, [activeId, activeIndex, measure]);

  // Re-measure on resize / font load (no animation).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    ro?.observe(track);
    const nav = navRef.current;
    nav?.addEventListener('scroll', updateEdges, { passive: true });
    const onResize = () => {
      measure();
      updateEdges();
    };
    window.addEventListener('resize', onResize);
    updateEdges();
    document.fonts?.ready?.then(() => measure()).catch(() => {});
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      nav?.removeEventListener('scroll', updateEdges);
    };
  }, [measure, updateEdges, items]);

  // Leading edge first, tail 70ms behind.
  const leadRight = beam.dir > 0;
  const transition = beam.ready
    ? `left .34s ${EASE} ${leadRight ? '.07s' : '0s'}, right .34s ${EASE} ${leadRight ? '0s' : '.07s'}`
    : 'none';

  const mask = edges.left || edges.right
    ? `linear-gradient(90deg, ${edges.left ? 'transparent 0, #000 28px' : '#000 0'}, ${edges.right ? '#000 calc(100% - 28px), transparent 100%' : '#000 100%'})`
    : 'none';

  return (
    <div className={`wotab-root relative min-h-[52px] flex items-end ${className}`}>
      <style>{TABS_CSS}</style>
      <nav
        ref={navRef}
        className="relative w-full overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitMaskImage: mask, maskImage: mask, touchAction: 'pan-x pan-y' }}
        aria-label="Work order sections"
      >
        <div ref={trackRef} className="relative flex w-max min-h-[48px] items-center gap-7 pb-1">
          {/* Rail with HUD ticks */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: 'rgba(34, 211, 238, 0.16)' }} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-1"
            style={{ bottom: 1, background: 'repeating-linear-gradient(90deg, rgba(34, 211, 238, 0.28) 0 1px, transparent 1px 14px)' }}
          />

          {items.map(({ id, label }) => {
            const isActive = activeId === id;
            return (
              <button
                key={id}
                ref={(node) => {
                  tabRefs.current[id] = node;
                }}
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`wotab-btn relative shrink-0 whitespace-nowrap pb-2.5 pt-2 text-sm touch-manipulation transition-colors duration-200 ${
                  isActive ? 'font-semibold' : 'font-medium text-white/40 hover:text-white/55'
                }`}
                style={isActive ? { color: '#CFFAFE', textShadow: '0 0 10px rgba(34, 211, 238, 0.75)' } : undefined}
              >
                {isActive ? <span key={`on-${id}`} className="wotab-lock">{label}</span> : label}
              </button>
            );
          })}

          {/* Beam */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ bottom: -1, height: 4, left: beam.left, right: beam.right, transition, opacity: beam.ready ? 1 : 0 }}
          >
            <span
              className="absolute"
              style={{ left: -6, right: -6, bottom: 0, height: 30, background: 'radial-gradient(60% 100% at 50% 100%, rgba(34, 211, 238, 0.22), rgba(34, 211, 238, 0) 75%)' }}
            />
            <span className="absolute inset-x-0 top-0 h-1 rounded-sm" style={{ background: '#22D3EE', boxShadow: '0 0 8px #22D3EE, 0 0 18px rgba(34, 211, 238, 0.7)' }} />
            <span
              className="wotab-core absolute rounded-[1px]"
              style={{ left: 3, right: 3, top: 1, height: 2, background: 'linear-gradient(90deg, rgba(240,255,255,0), #FFFFFF 18%, #FFFFFF 82%, rgba(240,255,255,0))' }}
            />
            <span className="absolute" style={{ left: -3, top: -3, width: 2, height: 10, background: '#A5F3FC', boxShadow: '0 0 6px #22D3EE' }} />
            <span className="absolute" style={{ right: -3, top: -3, width: 2, height: 10, background: '#A5F3FC', boxShadow: '0 0 6px #22D3EE' }} />
          </span>

          {spark.n > 0 ? (
            <span
              key={spark.n}
              aria-hidden="true"
              className="wotab-spark pointer-events-none absolute rounded-full"
              style={{ bottom: 1, left: spark.x, width: 14, height: 14, background: '#FFFFFF', boxShadow: '0 0 10px #FFFFFF, 0 0 22px #22D3EE, 0 0 40px #22D3EE' }}
            />
          ) : null}
        </div>
      </nav>
    </div>
  );
}
