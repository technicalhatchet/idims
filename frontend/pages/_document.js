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

        {process.env.NODE_ENV === 'development' ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{if(!('serviceWorker'in navigator))return;navigator.serviceWorker.getRegistrations().then(function(regs){var had=regs.length>0;return Promise.all(regs.map(function(r){return r.unregister()})).then(function(){if(!('caches'in window))return had;return caches.keys().then(function(names){return Promise.all(names.map(function(n){return caches.delete(n)}))}).then(function(){return had||names.length>0})})}).then(function(hadStale){if(hadStale&&!sessionStorage.getItem('idims_dev_sw_cleaned')){sessionStorage.setItem('idims_dev_sw_cleaned','1');location.reload()}})})}catch(e){}})();`,
            }}
          />
        ) : null}
      </Head>
      <body className="antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-150">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}