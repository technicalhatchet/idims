import { useEffect } from 'react';
import { useSolomonTheme } from '../../hooks/useSolomonTheme';

/** Keeps PWA theme-color meta in sync with active Solomon interface tokens. */
export default function SolomonThemeColorSync() {
  const { interfaceStyle, isSolomonRoute } = useSolomonTheme();

  useEffect(() => {
    if (!isSolomonRoute || typeof document === 'undefined') return undefined;

    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--solomon-theme-color')
      .trim();

    if (!color) return undefined;

    const metas = document.querySelectorAll('meta[name="theme-color"], meta[name="background-color"]');
    metas.forEach((meta) => {
      meta.setAttribute('content', color);
    });

    return undefined;
  }, [interfaceStyle, isSolomonRoute]);

  return null;
}
