import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Atomic Repair - Appliance Repair Management Portal" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />
        {/* apple-touch-icon is set per PWA route (e.g. /techboard) — avoid a global icon overriding the manifest */}
        
        {/* Add any preconnect links if needed */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Google Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        
        {/* CSRF Token for API requests security */}
        <meta name="csrf-token" content="{{csrfToken}}" />
      </Head>
      <body className="antialiased font-sans bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-150">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}