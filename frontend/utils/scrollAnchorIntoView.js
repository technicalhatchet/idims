/**
 * Smooth-scroll an element into view within its scrollable ancestors (WO portal, page, etc.).
 */
export function scrollAnchorIntoView(element, options = {}) {
  if (!element || typeof element.scrollIntoView !== 'function') return;
  element.scrollIntoView({
    behavior: options.behavior ?? 'smooth',
    block: options.block ?? 'start',
    inline: options.inline ?? 'nearest',
  });
}
