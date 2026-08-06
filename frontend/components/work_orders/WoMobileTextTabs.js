import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal text tabs for mobile WO — in normal document flow (not sticky/fixed).
 */
export default function WoMobileTextTabs({ items, activeId, onSelect, className = '' }) {
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const el = tabRefs.current[activeId];
    const nav = navRef.current;
    if (!el || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = el.getBoundingClientRect();
    setUnderline({
      left: tabRect.left - navRect.left + nav.scrollLeft,
      width: tabRect.width,
    });
  }, [activeId]);

  useEffect(() => {
    measure();
    const nav = navRef.current;
    if (!nav) return undefined;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(nav);
    window.addEventListener('resize', measure);
    nav.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      nav.removeEventListener('scroll', measure);
    };
  }, [measure, items]);

  return (
    <div className={`relative min-h-[48px] flex items-end ${className}`}>
      <nav
        ref={navRef}
        className="relative flex w-full min-h-[44px] items-center gap-7 overflow-x-auto overscroll-x-contain touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Work order sections"
      >
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
              className={`relative shrink-0 whitespace-nowrap pb-2.5 pt-2 text-sm font-medium transition-colors duration-200 touch-manipulation ${
                isActive ? 'text-cyan-400' : 'text-white/40 hover:text-white/55'
              }`}
            >
              {label}
            </button>
          );
        })}
        <span
          className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-cyan-400 transition-[left,width] duration-200 ease-out"
          style={{
            left: underline.left,
            width: underline.width,
            opacity: underline.width > 0 ? 1 : 0,
          }}
          aria-hidden
        />
      </nav>
    </div>
  );
}
