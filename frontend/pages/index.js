/**
 * Thin `/` entry: build-time branch so Safari paint test does not pull marketing modules.
 *
 * Preview minimal homepage:
 *   NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1
 *
 * SW isolation (Preview): NEXT_PUBLIC_PWA_OFF=1, NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1
 * Paint diag on marketing only: NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=1 (see HomepageMarketingPage.js)
 */

const HOMEPAGE_SAFARI_PAINT_TEST_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST === '1';

let HomePage = null;

if (HOMEPAGE_SAFARI_PAINT_TEST_ENABLED) {
  HomePage = require('../components/marketing/HomepageSafariPaintTest').default;
} else {
  HomePage = require('../components/marketing/HomepageMarketingPage').default;
}

export default function Home(props) {
  return <HomePage {...props} />;
}

if (!HOMEPAGE_SAFARI_PAINT_TEST_ENABLED) {
  Home.getLayout = HomePage.getLayout;
}
