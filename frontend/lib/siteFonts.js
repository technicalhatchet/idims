import { Inter } from 'next/font/google';

/** Site-wide UI font (marketing + app shell). Replaces render-blocking Google Fonts CSS for Inter. */
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});
