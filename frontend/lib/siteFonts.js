import { Inter } from 'next/font/google';

/** Site-wide UI font (marketing + app shell). Replaces render-blocking Google Fonts CSS for Inter. */
/** Variable Inter — avoids multi-weight Google fetches that fail next/font loader on some CI hosts. */
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
