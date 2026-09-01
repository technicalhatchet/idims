import { useSolomonThemeContext } from '../context/SolomonThemeContext';
import { SOLOMON_INTERFACE } from '../components/solomon/solomonThemeTokens';

/**
 * Read Solomon interface style and theme helpers.
 * Only meaningful on /solomon routes; defaults to Signature elsewhere.
 */
export function useSolomonTheme() {
  const ctx = useSolomonThemeContext();

  return {
    ...ctx,
    isSignature: ctx.interfaceStyle === SOLOMON_INTERFACE.SIGNATURE,
    /** CSS variable reference for inline styles */
    cssVar: (name) => `var(--solomon-${name})`,
  };
}

export default useSolomonTheme;
