import Head from 'next/head';
import { LOGIT_PWA_ICONS, LOGIT_PWA_VERSION } from './logitPwaIcons';

const LOGIT_THEME = '#0A0F1E';

export default function LogitHead({ title = 'LoGiT' }) {
  const pageTitle = title === 'LoGiT' ? 'LoGiT' : `${title} | LoGiT`;
  const manifestHref = `/manifest-logit.json?v=${LOGIT_PWA_VERSION}`;

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content="Think it. Say it. LoGiT." />
      <meta name="application-name" content="LoGiT" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="LoGiT" />
      <meta name="theme-color" content={LOGIT_THEME} />
      <meta name="background-color" content={LOGIT_THEME} />
      <meta name="color-scheme" content="dark" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <link rel="manifest" href={manifestHref} />
      <link rel="icon" type="image/png" href={LOGIT_PWA_ICONS.android192} />
      {/* iOS Add to Home Screen uses apple-touch-icon, not manifest icons */}
      <link rel="apple-touch-icon" sizes="180x180" href={LOGIT_PWA_ICONS.ios} />
      <link rel="apple-touch-icon" href={LOGIT_PWA_ICONS.ios} />
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){if(!('serviceWorker'in navigator))return;function boot(){navigator.serviceWorker.getRegistrations().then(function(regs){var origin=location.origin;regs.forEach(function(reg){var worker=reg.active||reg.installing||reg.waiting;var script=worker&&worker.scriptURL||'';if(script.indexOf('logit-sw.js')===-1&&(reg.scope===origin+'/'||reg.scope===origin)){reg.unregister();}});return navigator.serviceWorker.register('/logit-sw.js?v=${LOGIT_PWA_VERSION}',{scope:'/logit',updateViaCache:'none'});}).catch(function(){});}if(document.readyState==='complete'){boot();}else{window.addEventListener('load',boot,{once:true});}})();`,
        }}
      />
    </Head>
  );
}
