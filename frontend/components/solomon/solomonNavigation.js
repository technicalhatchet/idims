import { solomonBottomNavScrollPadding } from './solomonSafeArea';

/**
 * Solomon Professional mobile navigation helpers.
 */

const BOTTOM_NAV_HIDDEN_EXACT = new Set([
  '/solomon/diagnose',
  '/solomon/start',
  '/solomon/outcomes/new',
  '/solomon/signup',
]);

/** Height of bottom tab bar content (excluding safe-area). */
export const SOLOMON_BOTTOM_NAV_HEIGHT_PX = 56;

export function shouldShowSolomonBottomNav(pathname, { isProfessional } = {}) {
  if (!isProfessional || !pathname) return false;
  if (BOTTOM_NAV_HIDDEN_EXACT.has(pathname)) return false;
  return true;
}

export function solomonBottomNavPaddingStyle(showNav) {
  if (!showNav) return undefined;
  return {
    paddingBottom: solomonBottomNavScrollPadding(1),
  };
}

export function isSolomonNavActive(pathname, tab) {
  const path = pathname || '';
  switch (tab) {
    case 'home':
      return path === '/solomon';
    case 'sessions':
      return path === '/solomon/diagnostics' || /^\/solomon\/diagnostics\/[^/]+$/.test(path);
    case 'knowledge':
      return path === '/solomon/knowledge' || path.startsWith('/solomon/codes');
    case 'more':
      return path === '/solomon/more'
        || path === '/solomon/settings'
        || path === '/solomon/outcomes'
        || path.startsWith('/solomon/outcomes/');
    default:
      return false;
  }
}
