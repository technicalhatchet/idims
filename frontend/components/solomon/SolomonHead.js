import Head from 'next/head';

export default function SolomonHead({ title = 'Solomon' }) {
  const pageTitle = title === 'Solomon' ? 'Solomon' : `${title} | Solomon`;
  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="application-name" content="Solomon" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Solomon" />
      <meta name="theme-color" content="#0A0F1E" />
      <link rel="manifest" href="/manifest-solomon.json" />
    </Head>
  );
}
