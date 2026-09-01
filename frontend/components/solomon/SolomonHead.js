import Head from 'next/head';
import { SOLOMON_PWA_ICONS, SOLOMON_PWA_VERSION } from './solomonPwaIcons';

/** Fallback until SolomonThemeColorSync applies --solomon-theme-color from active tokens. */
const SOLOMON_SHELL_FALLBACK = '#0A0F1E';

export default function SolomonHead({ title = 'Solomon' }) {
  const pageTitle = title === 'Solomon' ? 'Solomon' : `${title} | Solomon`;
  const manifestHref = `/manifest-solomon.json?v=${SOLOMON_PWA_VERSION}`;

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="application-name" content="Solomon" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Solomon" />
      <meta name="theme-color" content={SOLOMON_SHELL_FALLBACK} />
      <meta name="background-color" content={SOLOMON_SHELL_FALLBACK} />
      <meta name="color-scheme" content="dark" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <link rel="manifest" href={manifestHref} />
      <link rel="icon" type="image/png" href={SOLOMON_PWA_ICONS.android192} />
      {/* iOS Add to Home Screen uses apple-touch-icon, not manifest icons */}
      <link rel="apple-touch-icon" sizes="180x180" href={SOLOMON_PWA_ICONS.ios} />
      <link rel="apple-touch-icon" href={SOLOMON_PWA_ICONS.ios} />
    </Head>
  );
}
