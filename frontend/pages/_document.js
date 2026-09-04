import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* theme-color, favicon, apple-touch-icon, and description are set per route (PWA + marketing pages). */}
        
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

        {process.env.NODE_ENV === 'development' ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{if(!('serviceWorker'in navigator))return;navigator.serviceWorker.getRegistrations().then(function(regs){var had=regs.length>0;return Promise.all(regs.map(function(r){return r.unregister()})).then(function(){if(!('caches'in window))return had;return caches.keys().then(function(names){return Promise.all(names.map(function(n){return caches.delete(n)}))}).then(function(){return had||names.length>0})})}).then(function(hadStale){if(hadStale&&!sessionStorage.getItem('idims_dev_sw_cleaned')){sessionStorage.setItem('idims_dev_sw_cleaned','1');location.reload()}})})}catch(e){}})();`,
            }}
          />
        ) : null}
      </Head>
      <body className="antialiased font-sans bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-150">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}