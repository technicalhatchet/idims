import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* theme-color, favicon, apple-touch-icon, and description are set per route (PWA + marketing pages). */}
        {/* Orbitron: loaded per-route on TechDeck HUD / mobile shells (not global — avoids marketing cold-load cost). */}

        {/* CSRF Token for API requests security */}
        <meta name="csrf-token" content="{{csrfToken}}" />

      </Head>
      <body className="antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-150">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}