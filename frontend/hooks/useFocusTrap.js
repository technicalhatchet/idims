import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Trap keyboard focus inside a container while active. Restores focus on deactivate.
 */
export default function useFocusTrap(active, containerRef, { initialFocusRef } = {}) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef?.current) return undefined;

    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    const focusInitial = () => {
      const target = initialFocusRef?.current || getFocusableElements(container)[0];
      target?.focus?.();
    };

    const frame = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;

      const focusables = getFocusableElements(container);
      if (!focusables.length) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      container.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current?.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, containerRef, initialFocusRef]);
}
