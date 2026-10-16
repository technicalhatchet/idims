import Head from 'next/head';
import {
  TECHDECK_APPLE_TOUCH_ICON,
  TECHDECK_BRAND_VERSION,
  TECHDECK_FAVICON_16,
  TECHDECK_FAVICON_32,
  TECHDECK_FAVICON_ICO,
  TECHDECK_FAVICON_SVG,
} from '../../constants/techdeckBrandAssets';

const TECHDECK_SHELL = '#0A0F1E';

export default function TechDeckPwaHead({
  manifestHref = `/manifest-techboard.json?v=${TECHDECK_BRAND_VERSION}`,
  appTitle = 'TechDeck',
}) {
  return (
    <Head>
      <meta name="theme-color" content={TECHDECK_SHELL} />
      <meta name="background-color" content={TECHDECK_SHELL} />
      <meta name="color-scheme" content="dark" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={appTitle} />
      <link rel="icon" href={TECHDECK_FAVICON_ICO} sizes="any" />
      <link rel="icon" type="image/svg+xml" href={TECHDECK_FAVICON_SVG} />
      <link rel="icon" type="image/png" sizes="16x16" href={TECHDECK_FAVICON_16} />
      <link rel="icon" type="image/png" sizes="32x32" href={TECHDECK_FAVICON_32} />
      <link rel="manifest" href={manifestHref} />
      <link rel="apple-touch-icon" sizes="180x180" href={TECHDECK_APPLE_TOUCH_ICON} />
      <link rel="apple-touch-icon" href={TECHDECK_APPLE_TOUCH_ICON} />
    </Head>
  );
}
