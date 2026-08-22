import Head from 'next/head';

const SOLOMON_SHELL = '#0A0F1E';
const MANIFEST_VERSION = 4;
const ICON_180 = `/solomonicon-180x180.png?v=${MANIFEST_VERSION}`;

export default function SolomonHead({ title = 'Solomon' }) {
  const pageTitle = title === 'Solomon' ? 'Solomon' : `${title} | Solomon`;
  const manifestHref = `/manifest-solomon.json?v=${MANIFEST_VERSION}`;

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="application-name" content="Solomon" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Solomon" />
      <meta name="theme-color" content={SOLOMON_SHELL} />
      <meta name="background-color" content={SOLOMON_SHELL} />
      <meta name="color-scheme" content="dark" />
      <link rel="manifest" href={manifestHref} />
      <link rel="icon" type="image/png" href={ICON_180} />
      {/* iOS Add to Home Screen uses apple-touch-icon, not manifest icons */}
      <link rel="apple-touch-icon" sizes="180x180" href={ICON_180} />
      <link rel="apple-touch-icon" href={ICON_180} />
    </Head>
  );
}
