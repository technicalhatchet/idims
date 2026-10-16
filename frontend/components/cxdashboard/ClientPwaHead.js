import Head from 'next/head';
import {
  PORTAL_APPLE_TOUCH_ICON,
  PORTAL_BRAND_VERSION,
  PORTAL_FAVICON_16,
  PORTAL_FAVICON_32,
  PORTAL_FAVICON_ICO,
} from '../../constants/portalBrandAssets';

const PORTAL_SHELL = '#0B0F1A';

export default function ClientPwaHead() {
  const v = `?v=${PORTAL_BRAND_VERSION}`;

  return (
    <Head>
      <meta name="theme-color" content={PORTAL_SHELL} />
      <meta name="background-color" content={PORTAL_SHELL} />
      <meta name="color-scheme" content="dark" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="AR Client" />
      <link rel="icon" href={PORTAL_FAVICON_ICO} sizes="any" />
      <link rel="icon" type="image/png" sizes="16x16" href={PORTAL_FAVICON_16} />
      <link rel="icon" type="image/png" sizes="32x32" href={PORTAL_FAVICON_32} />
      <link rel="manifest" href={`/manifest-client.json${v}`} />
      <link rel="apple-touch-icon" sizes="180x180" href={PORTAL_APPLE_TOUCH_ICON} />
      <link rel="apple-touch-icon" href={PORTAL_APPLE_TOUCH_ICON} />
    </Head>
  );
}
