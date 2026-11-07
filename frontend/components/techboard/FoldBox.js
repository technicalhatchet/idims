import { useLayoutEffect, useRef } from 'react';

/**
 * Smooth open/close for a panel under a card. Animates a measured pixel height
 * (0 ↔ content height), which iOS Safari interpolates evenly; an animated
 * grid-template-rows steps on iPhone. Height is released to `auto` once open so the
 * panel still grows when its rows finish loading.
 *
 * open: panel should be (or become) open. closing: it is folding shut (still mounted).
 */
export default function FoldBox({ open, closing, className = '', children }) {
  const outer = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    const el = outer.current;
    const content = inner.current;
    if (!el || !content) return undefined;
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== 'height') return;
      if (open) el.style.height = 'auto';
    };
    el.addEventListener('transitionend', onEnd);

    if (open) {
      const target = content.scrollHeight;
      if (reduce) {
        el.style.transition = 'none';
        el.style.height = 'auto';
      } else {
        el.style.transition = 'none';
        el.style.height = `${el.getBoundingClientRect().height}px`;
        // Force the start height to apply, then animate to the content height.
        void el.offsetHeight; // eslint-disable-line no-void
        el.style.transition = 'height .38s cubic-bezier(.2,.85,.25,1)';
        el.style.height = `${target}px`;
      }
    } else {
      el.style.transition = 'none';
      el.style.height = `${el.getBoundingClientRect().height}px`;
      void el.offsetHeight; // eslint-disable-line no-void
      el.style.transition = reduce ? 'none' : `height ${closing ? '.26s cubic-bezier(.5,0,.75,0)' : '0s'}`;
      el.style.height = '0px';
    }
    return () => el.removeEventListener('transitionend', onEnd);
  }, [open, closing]);

  return (
    <div ref={outer} className={className} style={{ height: 0, overflow: 'hidden', contain: 'layout paint' }}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
