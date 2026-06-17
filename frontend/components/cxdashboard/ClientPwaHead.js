import Head from 'next/head';

const PORTAL_SHELL = '#0B0F1A';
const MANIFEST_VERSION = 2;

export default function ClientPwaHead() {
  const v = `?v=${MANIFEST_VERSION}`;

  return (
    <Head>
      <meta name="theme-color" content={PORTAL_SHELL} />
      <meta name="background-color" content={PORTAL_SHELL} />
      <meta name="color-scheme" content="dark" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="AR Client" />
      <link rel="manifest" href={`/manifest-client.json${v}`} />
      <link rel="apple-touch-icon" sizes="180x180" href={`/portalicon-180x180.png${v}`} />
      <link rel="apple-touch-icon" href={`/portalicon-180x180.png${v}`} />
    </Head>
  );
}
